begin;
create function pg_temp.check_deadline(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.deadline_error(statement text,code text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then if sqlstate<>code then raise; end if; raise notice 'PASS: %',label; return; end;
raise exception 'FAIL: unexpectedly succeeded: %',label; end $$;

insert into public.users(id,name,email,password,is_email_verified,stripe_customer_id) values
 ('10000000-0000-4000-8000-000000000001','Buyer','deadline@example.test','fixture',true,'cus_fixture'),
 ('10000000-0000-4000-8000-000000000002','Other','deadline-other@example.test','fixture',true,'cus_other');
insert into public.products(id,name,category,brand,original_price,stock,sales_count,images,description,sku) values
 ('20000000-0000-4000-8000-000000000001','Product','CPU','Test',20,90,10,'{test.jpg}','Fixture','deadline');
insert into public.coupons(id,code,discount_type,discount_value,times_used) values
 ('60000000-0000-4000-8000-000000000001','DEADLINE','fixed',1,2);
insert into public.orders(id,user_id,shipping_address,payment_method,items_price,shipping_price,tax_price,total_price,
 is_paid,status,created_at,payment_expires_at,coupon_applied)
select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001','{}',case when n=4 then 'cod' else 'stripe' end,
 20,0,0,20,n=5,case when n=5 then 'paid' else 'pending' end,
 case when n in (2,6,8) then now()-interval '3 hours' when n=3 then now()-interval '90 minutes' else now() end,
 now()+interval '10 days',case when n=2 then '{"code":"DEADLINE"}'::jsonb else null end
from generate_series(1,9) n;
insert into public.order_items(order_id,product_id,name,image,price,quantity,price_snapshot)
select id,'20000000-0000-4000-8000-000000000001','Product','test.jpg',20,1,20 from public.orders;
insert into public.stripe_checkout_attempts(order_id,customer_id,amount_cents,expires_at,legacy)
select id,case when right(id::text,1)='6' then null else 'cus_fixture' end,2000,payment_expires_at,right(id::text,1)='6'
from public.orders where right(id::text,1) in ('6','8');

select pg_temp.check_deadline((select bool_and(payment_expires_at=created_at+interval '2 hours') from public.orders where payment_method='stripe'),'Stripe deadline is two hours from order creation, ignoring supplied deadline');
select pg_temp.check_deadline((select payment_expires_at is null from public.orders where payment_method='cod'),'COD has no card payment timeout');
update public.orders set payment_expires_at=now()+interval '20 days';
select pg_temp.check_deadline((select bool_and(payment_expires_at=created_at+interval '2 hours') from public.orders where payment_method='stripe'),'deadline cannot be extended by later updates');

set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.deadline_error($q$select public.claim_stripe_checkout('30000000-0000-4000-8000-000000000001','https://shop.example.test')$q$,'42501','foreign payment deadline cannot be bypassed');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare first jsonb; replay jsonb; begin
 first:=public.claim_stripe_checkout('30000000-0000-4000-8000-000000000001','https://shop.example.test');
 replay:=public.claim_stripe_checkout('30000000-0000-4000-8000-000000000001','https://changed.example.test');
 perform pg_temp.check_deadline(first->>'expires_at'=replay->>'expires_at' and first->>'attempt_id'=replay->>'attempt_id','checkout retries preserve the original deadline and attempt');
 perform pg_temp.check_deadline((first->>'expires_at')::timestamptz=date_trunc('second',(select payment_expires_at from public.orders where id='30000000-0000-4000-8000-000000000001')),'Checkout expiry uses the order deadline');
end $$;
select pg_temp.deadline_error($q$select public.claim_stripe_checkout('30000000-0000-4000-8000-000000000002','https://shop.example.test')$q$,'P0001','expired unstarted order cannot open checkout');
select pg_temp.deadline_error($q$select public.claim_stripe_checkout('30000000-0000-4000-8000-000000000008','https://shop.example.test')$q$,'P0001','expired existing attempt cannot reopen checkout');
select pg_temp.deadline_error($q$select public.claim_stripe_checkout('30000000-0000-4000-8000-000000000003','https://shop.example.test')$q$,'P0001','new Checkout requires enough time before the fixed deadline');
select pg_temp.deadline_error($q$select public.bind_stripe_checkout('30000000-0000-4000-8000-000000000008',(select attempt_id from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000008'),'cs_late','cus_fixture')$q$,'42501','customer cannot read privileged attempt identities');
select pg_temp.deadline_error($q$select public.reconcile_legacy_stripe_checkout('30000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000001','cus_fixture','cs_legacy')$q$,'42501','customer cannot reconcile provider identities');
reset role;
do $$ declare attempt uuid; begin
 select attempt_id into attempt from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000008';
 perform set_config('role','authenticated',true);
 perform pg_temp.deadline_error(format('select public.bind_stripe_checkout(%L,%L,%L,%L)',
 '30000000-0000-4000-8000-000000000008',attempt,'cs_late','cus_fixture'),'P0001','late provider response cannot bind expired checkout');
end $$;
reset role;
set local role anon;
select pg_temp.deadline_error($q$select public.reconcile_legacy_stripe_checkout('30000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000001','cus_fixture','cs_legacy')$q$,'42501','anonymous reconciliation denied');
reset role;
set local role service_role;
select pg_temp.deadline_error($q$select public.release_stripe_reservation('30000000-0000-4000-8000-000000000009',null,null,null,'not_started')$q$,'P0001','fresh unstarted inventory remains reserved');
select pg_temp.check_deadline(public.release_stripe_reservation('30000000-0000-4000-8000-000000000002',null,null,null,'not_started')->>'released'='true','expired unstarted order is cancelled');
select pg_temp.check_deadline(public.release_stripe_reservation('30000000-0000-4000-8000-000000000002',null,null,null,'not_started')->>'alreadyReleased'='true','duplicate expiry is idempotent');
select pg_temp.check_deadline((select stock=91 and sales_count=9 from public.products),'automatic cancellation restores inventory once');
select pg_temp.check_deadline((select times_used=1 from public.coupons),'automatic cancellation restores coupon usage once');
select pg_temp.check_deadline((select status='cancelled' and not is_paid from public.orders where id='30000000-0000-4000-8000-000000000002'),'cancelled order stays in history as unpaid');
select pg_temp.check_deadline(public.release_stripe_reservation('30000000-0000-4000-8000-000000000005',null,null,null,'not_started')->>'paid'='true','paid orders are never automatically cancelled');
do $$ declare attempt uuid; bound jsonb; begin
 select attempt_id into attempt from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000006';
 bound:=public.reconcile_legacy_stripe_checkout('30000000-0000-4000-8000-000000000006',attempt,'cus_fixture','cs_legacy','pi_legacy');
 perform pg_temp.check_deadline(bound->>'customer_id'='cus_fixture' and bound->>'session_id'='cs_legacy','verified legacy customer/session can be recovered');
 perform pg_temp.deadline_error(format('select public.reconcile_legacy_stripe_checkout(%L,%L,%L,%L,%L)',
 '30000000-0000-4000-8000-000000000006',attempt,'cus_other','cs_other','pi_other'),'P0001','legacy identity cannot be replaced');
 perform pg_temp.check_deadline(public.release_stripe_reservation('30000000-0000-4000-8000-000000000006',attempt,'cs_legacy','pi_legacy','session_expired')->>'released'='true','verified expired legacy session can be cancelled');
 perform pg_temp.deadline_error(format('select public.reconcile_legacy_stripe_checkout(%L,%L,%L,%L,%L)',
 '30000000-0000-4000-8000-000000000006',attempt,'cus_fixture','cs_legacy','pi_legacy'),'P0001','released order cannot regain a payable legacy binding');
end $$;
reset role;
rollback;
