begin;

-- Checkout is a narrow privileged operation, not a general table-write grant.
-- No caller-supplied owner, line items, prices, totals or stock deltas are accepted.
create or replace function public.checkout_cart(
  p_shipping_address_id uuid default null,
  p_shipping_address jsonb default null,
  p_payment_method text default 'stripe',
  p_idempotency_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_cart public.carts%rowtype;
  v_address jsonb;
  v_order public.orders%rowtype;
  v_coupon public.coupons%rowtype;
  v_item record;
  v_field text;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_shipping numeric;
  v_tax numeric;
  v_coupon_snapshot jsonb;
  v_count integer;
  v_usage integer;
begin
  if v_user is null or not exists (
    select 1 from public.users where id = v_user and active is true and is_email_verified is true
  ) then
    raise exception 'A verified active account is required' using errcode = '42501';
  end if;
  if p_payment_method is null or p_payment_method not in ('stripe', 'paypal', 'cod') then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 255 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  -- Serialize checkout attempts for this owner, including retries with new keys.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  select * into v_order from public.orders
    where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_items
      from public.order_items i where i.order_id = v_order.id;
    if jsonb_array_length(v_items) = 0 then
      raise exception 'Previous checkout is incomplete; use a new checkout attempt' using errcode = '22023';
    end if;
    return jsonb_build_object('order', to_jsonb(v_order) || jsonb_build_object('orderItems', v_items), 'reused', true);
  end if;

  if p_shipping_address_id is not null then
    select jsonb_build_object('fullName', a.full_name, 'address', a.address, 'city', a.city,
      'state', a.state, 'postalCode', a.postal_code, 'country', a.country, 'phoneNumber', a.phone_number)
    into v_address from public.user_addresses a where a.id = p_shipping_address_id and a.user_id = v_user;
    if not found then raise exception 'Shipping address not found' using errcode = '22023'; end if;
  else
    v_address := p_shipping_address;
  end if;
  if v_address is null or jsonb_typeof(v_address) <> 'object' then
    raise exception 'Shipping address is required' using errcode = '22023';
  end if;
  foreach v_field in array array['fullName','address','city','state','postalCode','country'] loop
    if jsonb_typeof(v_address->v_field) is distinct from 'string'
       or length(btrim(v_address->>v_field)) < 2 or length(v_address->>v_field) > 255 then
      raise exception 'Shipping address % is required or invalid', v_field using errcode = '22023';
    end if;
  end loop;
  -- Retain only public shipping fields; no arbitrary metadata in order snapshots.
  select jsonb_object_agg(key, value) into v_address from jsonb_each(v_address)
    where key = any(array['fullName','address','city','state','postalCode','country','phoneNumber']);

  select * into v_cart from public.carts where user_id = v_user for update;
  if not found then raise exception 'Cart is empty' using errcode = '22023'; end if;
  perform 1 from public.cart_items where cart_id = v_cart.id order by product_id for update;
  select count(*) into v_count from public.cart_items where cart_id = v_cart.id;
  if v_count = 0 or v_count > 50 then
    raise exception 'Cart must contain between 1 and 50 items' using errcode = '22023';
  end if;
  -- Lock all products in a stable order before validating inventory and pricing.
  perform p.id from public.products p join public.cart_items i on i.product_id = p.id
    where i.cart_id = v_cart.id order by p.id for update of p;
  for v_item in
    select i.product_id, i.quantity, p.name, p.images, p.stock, p.is_active,
      coalesce(p.final_price, p.original_price) as price
    from public.cart_items i left join public.products p on p.id = i.product_id
    where i.cart_id = v_cart.id order by i.product_id
  loop
    if v_item.is_active is not true or v_item.quantity is null or v_item.quantity <= 0
       or v_item.price is null or v_item.price < 0 then
      raise exception 'One or more cart items are unavailable or invalid' using errcode = '22023';
    end if;
    if v_item.stock < v_item.quantity then
      raise exception 'Insufficient stock; please review your cart' using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + v_item.price * v_item.quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object('product_id', v_item.product_id,
      'name', v_item.name, 'image', coalesce(v_item.images[1], ''), 'price', v_item.price,
      'quantity', v_item.quantity, 'price_snapshot', v_item.price));
  end loop;

  if v_cart.coupon_id is not null then
    select * into v_coupon from public.coupons where id = v_cart.coupon_id for update;
    if not found or v_coupon.is_active is not true
      or v_coupon.valid_from > now() or v_coupon.valid_to < now()
      or (v_coupon.usage_limit is not null and coalesce(v_coupon.times_used, 0) >= v_coupon.usage_limit)
      or v_subtotal < coalesce(v_coupon.min_purchase, 0) then
      raise exception 'Coupon is no longer valid for this order' using errcode = '22023';
    end if;
    if exists(select 1 from public.cart_items i where i.cart_id = v_cart.id and
      ((coalesce(cardinality(v_coupon.applicable_products), 0) > 0 and not(i.product_id = any(v_coupon.applicable_products)))
       or i.product_id = any(v_coupon.excluded_products))) then
      raise exception 'Coupon is not applicable to these products' using errcode = '22023';
    end if;
    select count(*) into v_usage from public.orders where user_id = v_user
      and status <> 'cancelled' and coupon_applied->>'code' = v_coupon.code;
    if v_coupon.per_user_limit is not null and v_usage >= v_coupon.per_user_limit then
      raise exception 'Coupon usage limit reached' using errcode = '22023';
    end if;
    if v_coupon.discount_type in ('percent', 'percentage') then
      if v_coupon.discount_value not between 0 and 100 then
        raise exception 'Invalid coupon discount' using errcode = '22023';
      end if;
      v_discount := v_subtotal * v_coupon.discount_value / 100;
    elsif v_coupon.discount_type = 'fixed' and v_coupon.discount_value >= 0 then
      v_discount := v_coupon.discount_value;
    else raise exception 'Invalid coupon discount' using errcode = '22023';
    end if;
    if v_coupon.max_discount is not null and v_coupon.max_discount >= 0 then
      v_discount := least(v_discount, v_coupon.max_discount);
    end if;
    v_discount := round(least(v_subtotal, greatest(0, v_discount)), 2);
    v_coupon_snapshot := jsonb_build_object('code', v_coupon.code, 'discountType', v_coupon.discount_type,
      'discountValue', v_coupon.discount_value, 'discountAmount', v_discount);
  end if;
  v_subtotal := round(v_subtotal, 2);
  v_shipping := case when v_subtotal - v_discount >= 100 then 0 else 10 end;
  v_tax := round((v_subtotal - v_discount) * 0.1, 2);

  insert into public.orders(user_id, shipping_address, payment_method, items_price, discount_amount,
    shipping_price, tax_price, total_price, coupon_applied, is_paid, is_delivered, status, idempotency_key)
  values(v_user, v_address, p_payment_method, v_subtotal, v_discount, v_shipping, v_tax,
    v_subtotal - v_discount + v_shipping + v_tax, v_coupon_snapshot, false, false, 'pending', p_idempotency_key)
  returning * into v_order;
  insert into public.order_items(order_id, product_id, name, image, price, quantity, price_snapshot)
    select v_order.id, x.product_id, x.name, x.image, x.price, x.quantity, x.price_snapshot
    from jsonb_to_recordset(v_items) as x(product_id uuid, name text, image text, price numeric, quantity int, price_snapshot numeric);
  update public.products p set stock = p.stock - i.quantity,
    sales_count = coalesce(p.sales_count, 0) + i.quantity, updated_at = now()
    from public.cart_items i where i.cart_id = v_cart.id and i.product_id = p.id;
  if v_coupon.id is not null then
    update public.coupons set times_used = coalesce(times_used, 0) + 1 where id = v_coupon.id;
  end if;
  delete from public.cart_items where cart_id = v_cart.id;
  update public.carts set coupon_id = null, updated_at = now() where id = v_cart.id;
  select jsonb_agg(to_jsonb(i)) into v_items from public.order_items i where i.order_id = v_order.id;
  return jsonb_build_object('order', to_jsonb(v_order) || jsonb_build_object('orderItems', v_items), 'reused', false);
end;
$$;

revoke all on function public.checkout_cart(uuid, jsonb, text, text) from public, anon;
grant execute on function public.checkout_cart(uuid, jsonb, text, text) to authenticated;
comment on function public.checkout_cart(uuid, jsonb, text, text) is
  'Atomic owner checkout. Uses auth.uid(), authoritative cart/prices and row locks; no caller-supplied totals or stock changes.';
notify pgrst, 'reload schema';
commit;
