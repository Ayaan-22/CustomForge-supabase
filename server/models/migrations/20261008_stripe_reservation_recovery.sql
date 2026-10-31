begin;

-- Reservations expire independently of provider delivery. A durable attempt is
-- claimed before creating a Checkout Session, so an ambiguous HTTP response can
-- be reconciled without creating another payable session or guessing payment state.
alter table public.orders add column if not exists inventory_released_at timestamptz;
alter table public.orders add column if not exists payment_recovery_checked_at timestamptz;
alter table public.orders add column if not exists reserved_coupon_id uuid references public.coupons(id) on delete set null;
update public.orders o set reserved_coupon_id = c.id from public.coupons c
  where o.reserved_coupon_id is null and o.coupon_applied->>'code' = c.code;

create or replace function public.capture_order_coupon() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if NEW.coupon_applied is not null then
    select id into NEW.reserved_coupon_id from public.coupons where code = NEW.coupon_applied->>'code';
  end if;
  return NEW;
end $$;
revoke all on function public.capture_order_coupon() from public, anon, authenticated;
drop trigger if exists capture_order_coupon on public.orders;
create trigger capture_order_coupon before insert on public.orders for each row execute function public.capture_order_coupon();

create table if not exists public.stripe_checkout_attempts (
  order_id uuid primary key references public.orders(id) on delete cascade,
  attempt_id uuid not null unique default gen_random_uuid(),
  customer_id text,
  amount_cents bigint not null check (amount_cents > 0),
  redirect_origin text,
  session_id text unique,
  intent_id text unique,
  expires_at timestamptz not null,
  legacy boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.stripe_checkout_attempts enable row level security;
revoke all on public.stripe_checkout_attempts from public, anon, authenticated;
grant select, insert, update on public.stripe_checkout_attempts to service_role;
create index if not exists idx_orders_stripe_recovery on public.orders(created_at, id)
  where payment_method = 'stripe' and is_paid is false and inventory_released_at is null;

-- Existing unbound provider requests are ambiguous: discover their sessions by
-- owner/customer/order metadata before release. Never treat legacy as unstarted.
insert into public.stripe_checkout_attempts(order_id, customer_id, amount_cents, session_id, intent_id, expires_at, legacy, created_at)
select o.id, coalesce(o.payment_result->>'stripeCustomerId', u.stripe_customer_id),
  round(o.total_price * 100)::bigint, o.payment_result->>'checkoutSessionId',
  o.payment_result->>'transaction_id', o.created_at + interval '24 hours', true, o.created_at
from public.orders o join public.users u on u.id = o.user_id
where o.payment_method = 'stripe' and o.is_paid is false and o.status in ('pending', 'processing')
  and o.total_price > 0 and o.inventory_released_at is null
on conflict (order_id) do nothing;

create or replace function public.claim_stripe_checkout(p_order_id uuid, p_redirect_origin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_attempt public.stripe_checkout_attempts%rowtype; v_customer text;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found' using errcode = '42501'; end if;
  if v_order.payment_method <> 'stripe' or v_order.is_paid is distinct from false
    or v_order.status not in ('pending', 'processing') or v_order.inventory_released_at is not null then
    raise exception 'This order cannot accept payment' using errcode = 'P0001';
  end if;
  select * into v_attempt from public.stripe_checkout_attempts where order_id = p_order_id;
  if found then return to_jsonb(v_attempt); end if;
  if v_order.created_at <= now() - interval '1 hour' then
    raise exception 'The unpaid reservation has expired; create a new order' using errcode = 'P0001';
  end if;
  select stripe_customer_id into v_customer from public.users
    where id = auth.uid() and active is true and is_email_verified is true;
  if v_customer is null or v_customer !~ '^cus_[a-zA-Z0-9]+$' then
    raise exception 'A verified payment customer is required' using errcode = '22023';
  end if;
  if p_redirect_origin is null or length(p_redirect_origin) > 512
    or p_redirect_origin !~ '^https?://' then
    raise exception 'Invalid payment redirect origin' using errcode = '22023';
  end if;
  insert into public.stripe_checkout_attempts(order_id, customer_id, amount_cents, redirect_origin, expires_at)
  values(p_order_id, v_customer, round(v_order.total_price * 100)::bigint, p_redirect_origin,
    date_trunc('second', now()) + interval '1 hour') returning * into v_attempt;
  return to_jsonb(v_attempt);
end $$;
revoke all on function public.claim_stripe_checkout(uuid, text) from public, anon, service_role;
grant execute on function public.claim_stripe_checkout(uuid, text) to authenticated;

create or replace function public.bind_stripe_checkout(
  p_order_id uuid, p_attempt_id uuid, p_session_id text, p_customer_id text, p_intent_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_attempt public.stripe_checkout_attempts%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found' using errcode = '42501'; end if;
  select * into v_attempt from public.stripe_checkout_attempts where order_id = p_order_id;
  if not found or v_attempt.attempt_id is distinct from p_attempt_id
    or v_attempt.customer_id is distinct from p_customer_id or p_session_id is null
    or (v_attempt.session_id is not null and v_attempt.session_id <> p_session_id)
    or (v_attempt.intent_id is not null and p_intent_id is not null and v_attempt.intent_id <> p_intent_id) then
    raise exception 'Payment attempt does not match order' using errcode = 'P0001';
  end if;
  if v_order.inventory_released_at is not null or v_order.is_paid is distinct from false
    or v_order.status not in ('pending', 'processing') then
    raise exception 'This order cannot accept payment' using errcode = 'P0001';
  end if;
  update public.stripe_checkout_attempts set session_id = p_session_id, intent_id = coalesce(intent_id, p_intent_id) where order_id = p_order_id;
  update public.orders set payment_result = coalesce(payment_result, '{}'::jsonb)
    || jsonb_build_object('checkoutSessionId', p_session_id, 'stripeCustomerId', p_customer_id, 'checkoutAttemptId', p_attempt_id),
    updated_at = clock_timestamp() where id = p_order_id;
  return jsonb_build_object('id', p_order_id, 'sessionId', p_session_id);
end $$;
revoke all on function public.bind_stripe_checkout(uuid, uuid, text, text, text) from public, anon, service_role;
grant execute on function public.bind_stripe_checkout(uuid, uuid, text, text, text) to authenticated;

-- Provider observations are checked by the server. The database fences them by
-- immutable attempt/session/intent identity and shares its order lock with settlement.
create or replace function public.release_stripe_reservation(
  p_order_id uuid, p_attempt_id uuid default null, p_session_id text default null,
  p_intent_id text default null, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_attempt public.stripe_checkout_attempts%rowtype; v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.payment_method <> 'stripe' then raise exception 'Stripe order not found' using errcode = '22023'; end if;
  if v_order.inventory_released_at is not null then return jsonb_build_object('released', false, 'alreadyReleased', true); end if;
  if v_order.is_paid is distinct from false then return jsonb_build_object('released', false, 'paid', v_order.is_paid is true); end if;
  if v_order.status not in ('pending', 'processing') then raise exception 'Order requires reconciliation' using errcode = 'P0001'; end if;
  select * into v_attempt from public.stripe_checkout_attempts where order_id = p_order_id;
  if p_reason = 'not_started' then
    if found or p_attempt_id is not null or p_session_id is not null or p_intent_id is not null
      or v_order.created_at > now() - interval '1 hour' then
      raise exception 'Reservation cannot be released without provider reconciliation' using errcode = 'P0001';
    end if;
  else
    if not found or v_attempt.attempt_id is distinct from p_attempt_id
      or (v_attempt.session_id is not null and v_attempt.session_id is distinct from p_session_id)
      or (v_attempt.intent_id is not null and v_attempt.intent_id is distinct from p_intent_id) then
      raise exception 'Stale payment recovery observation' using errcode = 'P0001';
    end if;
    if p_reason = 'abandoned_attempt' then
      if v_attempt.session_id is not null or p_session_id is not null
        or v_attempt.expires_at > now() - interval '5 minutes' then
        raise exception 'Provider creation may still be in progress' using errcode = 'P0001';
      end if;
    elsif p_reason = 'session_expired' then
      if p_session_id is null then raise exception 'Expired session identity required' using errcode = '22023'; end if;
    elsif p_reason = 'intent_cancelled' then
      if p_session_id is null or p_intent_id is null then raise exception 'Cancelled payment identity required' using errcode = '22023'; end if;
    else raise exception 'Invalid recovery reason' using errcode = '22023'; end if;
    update public.stripe_checkout_attempts set session_id = coalesce(session_id, p_session_id), intent_id = coalesce(intent_id, p_intent_id) where order_id = p_order_id;
  end if;
  perform p.id from public.products p join public.order_items i on i.product_id = p.id
    where i.order_id = p_order_id order by p.id for update of p;
  if not exists(select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'Missing reserved inventory' using errcode = 'P0001';
  end if;
  for v_item in select product_id, sum(quantity)::integer quantity from public.order_items where order_id = p_order_id group by product_id loop
    if v_item.product_id is null or v_item.quantity <= 0 then raise exception 'Invalid reserved inventory' using errcode = 'P0001'; end if;
    update public.products set stock = stock + v_item.quantity,
      sales_count = greatest(0, coalesce(sales_count, 0) - v_item.quantity), updated_at = now() where id = v_item.product_id;
    if not found then raise exception 'Reserved product is unavailable' using errcode = 'P0001'; end if;
  end loop;
  if v_order.reserved_coupon_id is not null then
    update public.coupons set times_used = greatest(0, coalesce(times_used, 0) - 1) where id = v_order.reserved_coupon_id;
  end if;
  update public.orders set status = 'cancelled', inventory_released_at = clock_timestamp(), updated_at = clock_timestamp(),
    payment_result = coalesce(payment_result, '{}'::jsonb)
      || jsonb_build_object('reservationReleaseReason', p_reason, 'reservationReleasedAt', clock_timestamp()) where id = p_order_id;
  return jsonb_build_object('released', true, 'orderId', p_order_id);
end $$;
revoke all on function public.release_stripe_reservation(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.release_stripe_reservation(uuid, uuid, text, text, text) to service_role;

create or replace function public.settle_stripe_order(
  p_order_id uuid, p_attempt_id uuid, p_session_id text, p_intent_id text,
  p_customer_id text, p_amount_cents bigint, p_currency text, p_email text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_attempt public.stripe_checkout_attempts%rowtype; v_review boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.payment_method <> 'stripe' then raise exception 'Stripe order not found' using errcode = '22023'; end if;
  select * into v_attempt from public.stripe_checkout_attempts where order_id = p_order_id;
  if not found or v_attempt.attempt_id is distinct from p_attempt_id
    or v_attempt.customer_id is distinct from p_customer_id or p_session_id is null or p_intent_id is null
    or (v_attempt.session_id is not null and v_attempt.session_id <> p_session_id)
    or (v_attempt.intent_id is not null and v_attempt.intent_id <> p_intent_id)
    or p_currency is distinct from 'usd' or p_amount_cents is distinct from v_attempt.amount_cents
    or p_amount_cents <> round(v_order.total_price * 100)::bigint then
    raise exception 'Settlement does not match payment reservation' using errcode = 'P0001';
  end if;
  if v_order.is_paid is true then
    if v_order.payment_result->>'transaction_id' is distinct from p_intent_id then
      raise exception 'Conflicting payment requires reconciliation' using errcode = 'P0001';
    end if;
    return jsonb_build_object('paid', true, 'reused', true, 'reconciliationRequired', v_order.status = 'payment_review');
  end if;
  v_review := v_order.inventory_released_at is not null or v_order.status not in ('pending', 'processing');
  update public.stripe_checkout_attempts set session_id = p_session_id, intent_id = p_intent_id where order_id = p_order_id;
  update public.orders set is_paid = true, paid_at = clock_timestamp(),
    status = case when v_review then 'payment_review' else 'paid' end, updated_at = clock_timestamp(),
    payment_result = coalesce(payment_result, '{}'::jsonb) || jsonb_build_object('id', p_intent_id, 'transaction_id', p_intent_id,
      'status', 'succeeded', 'payment_method', 'stripe', 'checkoutSessionId', p_session_id, 'stripeCustomerId', p_customer_id,
      'checkoutAttemptId', p_attempt_id, 'email_address', p_email, 'update_time', clock_timestamp(), 'reconciliationRequired', v_review)
    where id = p_order_id;
  return jsonb_build_object('paid', true, 'reused', false, 'reconciliationRequired', v_review);
end $$;
revoke all on function public.settle_stripe_order(uuid, uuid, text, text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.settle_stripe_order(uuid, uuid, text, text, text, bigint, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
