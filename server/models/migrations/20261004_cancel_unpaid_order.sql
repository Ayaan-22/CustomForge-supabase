begin;
-- Only unpaid COD orders can be cancelled without provider reconciliation.
-- The owner comes from the request JWT, never from a caller-supplied user ID.
create or replace function public.cancel_unpaid_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_item record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_order from public.orders where id=p_order_id and user_id=auth.uid() for update;
  if not found then raise exception 'Order not found' using errcode='42501'; end if;
  if v_order.status='cancelled' then return jsonb_build_object('id',v_order.id,'status','cancelled'); end if;
  if v_order.is_paid is distinct from false or v_order.status <> 'pending' or v_order.payment_method <> 'cod' then
    raise exception 'Only pending unpaid cash-on-delivery orders can be cancelled; card orders require provider reconciliation' using errcode='P0001';
  end if;
  perform p.id from public.products p join public.order_items i on i.product_id=p.id
    where i.order_id=p_order_id order by p.id for update of p;
  for v_item in select product_id,sum(quantity)::integer quantity from public.order_items where order_id=p_order_id group by product_id loop
    if v_item.product_id is null or v_item.quantity <= 0 then raise exception 'Invalid order inventory' using errcode='P0001'; end if;
    update public.products set stock=stock+v_item.quantity,sales_count=greatest(0,coalesce(sales_count,0)-v_item.quantity),updated_at=now() where id=v_item.product_id;
    if not found then raise exception 'Order inventory is unavailable' using errcode='P0001'; end if;
  end loop;
  update public.orders set status='cancelled',updated_at=now() where id=p_order_id;
  -- Coupon use remains consumed: releasing it is a separate merchant policy.
  return jsonb_build_object('id',p_order_id,'status','cancelled');
end $$;
revoke all on function public.cancel_unpaid_order(uuid) from public,anon,service_role;
grant execute on function public.cancel_unpaid_order(uuid) to authenticated;
commit;
