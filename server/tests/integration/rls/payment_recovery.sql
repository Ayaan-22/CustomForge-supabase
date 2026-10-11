-- Real PostgreSQL state transitions. Fixtures and provider-free observations roll back.
begin;
create function pg_temp.check_recovery(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.recovery_error(statement text,code text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then if sqlstate<>code then raise; end if; raise notice 'PASS: %',label; return; end;
raise exception 'FAIL: unexpectedly succeeded: %',label; end $$;

insert into public.users(id,name,email,password,is_email_verified,stripe_customer_id) values
 ('10000000-0000-4000-8000-000000000001','Buyer','recover@example.test','fixture',true,'cus_fixture'),
 ('10000000-0000-4000-8000-000000000002','Other','other-recover@example.test','fixture',true,'cus_other');
insert into public.products(id,name,category,brand,original_price,stock,sales_count,images,description,sku) values
 ('20000000-0000-4000-8000-000000000001','Product','CPU','Test',10,88,12,'{test.jpg}','Fixture','recover');
insert into public.coupons(id,code,discount_type,discount_value,times_used) values
 ('60000000-0000-4000-8000-000000000001','RECOVERY','fixed',1,6);
insert into public.orders(id,user_id,shipping_address,payment_method,items_price,shipping_price,tax_price,total_price,is_paid,status,coupon_applied,created_at)
select ('30000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001','{}','stripe',20,0,0,20,false,'pending','{"code":"RECOVERY"}',
 case when n=1 then now()-interval '3 hours' else now() end from generate_series(1,6) n;
insert into public.order_items(order_id,product_id,name,image,price,quantity,price_snapshot)
select id,'20000000-0000-4000-8000-000000000001','Product','test.jpg',10,2,10 from public.orders;

set local role anon;
select pg_temp.recovery_error($q$select public.release_stripe_reservation('30000000-0000-4000-8000-000000000001')$q$,'42501','anonymous recovery denied');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.recovery_error($q$select public.claim_stripe_checkout('30000000-0000-4000-8000-000000000002','https://shop.example.test')$q$,'42501','another owners checkout claim denied');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select pg_temp.recovery_error($q$select * from public.stripe_checkout_attempts$q$,'42501','customer cannot read privileged provider attempt table');
select pg_temp.recovery_error($q$select public.release_stripe_reservation('30000000-0000-4000-8000-000000000001',null,null,null,'not_started')$q$,'42501','customer cannot invent provider release evidence');
select pg_temp.recovery_error($q$select public.settle_stripe_order('30000000-0000-4000-8000-000000000001',null,'cs_fake','pi_fake','cus_fixture',2000,'usd')$q$,'42501','customer cannot mark their order paid');
select pg_temp.recovery_error($q$select public.claim_stripe_checkout('30000000-0000-4000-8000-000000000001','https://shop.example.test')$q$,'P0001','expired unstarted orders cannot race into checkout');

do $$ declare first jsonb; replay jsonb; n integer; v_order uuid; claimed jsonb; begin
 first:=public.claim_stripe_checkout('30000000-0000-4000-8000-000000000002','https://shop.example.test');
 replay:=public.claim_stripe_checkout('30000000-0000-4000-8000-000000000002','https://changed.example.test');
 perform pg_temp.check_recovery(first->>'attempt_id'=replay->>'attempt_id' and first->>'redirect_origin'=replay->>'redirect_origin','claim retries keep attempt and provider parameters stable');
 for n in 2..4 loop
   v_order:=('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
   claimed:=public.claim_stripe_checkout(v_order,'https://shop.example.test');
   perform public.bind_stripe_checkout(v_order,(claimed->>'attempt_id')::uuid,'cs_recover_'||n,'cus_fixture','pi_recover_'||n);
 end loop;
 perform public.claim_stripe_checkout('30000000-0000-4000-8000-000000000006','https://shop.example.test');
end $$;
select pg_temp.recovery_error($q$select public.bind_stripe_checkout('30000000-0000-4000-8000-000000000002',(public.claim_stripe_checkout('30000000-0000-4000-8000-000000000002','https://shop.example.test')->>'attempt_id')::uuid,'cs_other','cus_fixture')$q$,'P0001','claim cannot bind a second payable session');
reset role;
update public.coupons set code='RENAMED';
select pg_temp.check_recovery((select bool_and(reserved_coupon_id='60000000-0000-4000-8000-000000000001') from public.orders),'coupon reservation preserves identity across code changes');
set local role service_role;
select pg_temp.check_recovery(public.release_stripe_reservation('30000000-0000-4000-8000-000000000001',null,null,null,'not_started')->>'released'='true','unstarted reservation releases after deadline');
select pg_temp.check_recovery(public.release_stripe_reservation('30000000-0000-4000-8000-000000000001',null,null,null,'not_started')->>'alreadyReleased'='true','duplicate recovery is idempotent');
select pg_temp.check_recovery((select stock=90 and sales_count=10 from public.products),'duplicate recovery restores stock and sales exactly once');
select pg_temp.check_recovery((select times_used=5 from public.coupons),'released Stripe reservation returns global coupon use');
select pg_temp.recovery_error($q$select public.release_stripe_reservation('30000000-0000-4000-8000-000000000005',null,null,null,'not_started')$q$,'P0001','fresh unstarted reservation remains held');
select pg_temp.recovery_error($q$select public.release_stripe_reservation('30000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001','cs_recover_2','pi_recover_2','session_expired')$q$,'P0001','stale attempt identity cannot release another generation');

-- Settlement wins first: release observes payment under the same order lock.
select pg_temp.check_recovery(public.settle_stripe_order('30000000-0000-4000-8000-000000000003',
 (select attempt_id from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000003'),
 'cs_recover_3','pi_recover_3','cus_fixture',2000,'usd')->>'paid'='true','settlement records authoritative provider identity');
select pg_temp.check_recovery(public.release_stripe_reservation('30000000-0000-4000-8000-000000000003',
 (select attempt_id from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000003'),
 'cs_recover_3','pi_recover_3','session_expired')->>'paid'='true','settlement first prevents restocking paid inventory');
select pg_temp.check_recovery((select stock=90 from public.products),'paid-first ordering keeps inventory reserved');

-- Release wins first: a late capture must be recorded for review, never fulfillment.
select public.release_stripe_reservation('30000000-0000-4000-8000-000000000004',
 (select attempt_id from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000004'),
 'cs_recover_4','pi_recover_4','intent_cancelled');
select pg_temp.check_recovery(public.settle_stripe_order('30000000-0000-4000-8000-000000000004',
 (select attempt_id from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000004'),
 'cs_recover_4','pi_recover_4','cus_fixture',2000,'usd')->>'reconciliationRequired'='true','late success after release requires reconciliation');
select pg_temp.check_recovery((select status='payment_review' and is_paid and inventory_released_at is not null from public.orders where id='30000000-0000-4000-8000-000000000004'),'late paid order cannot enter fulfillment');
select pg_temp.check_recovery((select stock=92 and sales_count=8 from public.products),'late settlement never silently reclaims released inventory');
select pg_temp.check_recovery(public.settle_stripe_order('30000000-0000-4000-8000-000000000004',
 (select attempt_id from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000004'),
 'cs_recover_4','pi_recover_4','cus_fixture',2000,'usd')->>'reused'='true','late settlement replay is idempotent');
select pg_temp.recovery_error($q$select public.settle_stripe_order('30000000-0000-4000-8000-000000000003',(select attempt_id from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000003'),'cs_recover_3','pi_other','cus_fixture',2000,'usd')$q$,'P0001','different payment cannot overwrite settlement');
reset role;

create function pg_temp.fail_recovery_commit() returns trigger language plpgsql as $$
begin if NEW.inventory_released_at is not null and OLD.inventory_released_at is null then raise exception 'late recovery failure' using errcode='23514'; end if; return NEW; end $$;
create trigger fail_recovery_commit before update on public.orders for each row execute function pg_temp.fail_recovery_commit();
set local role service_role;
select pg_temp.recovery_error($q$select public.release_stripe_reservation('30000000-0000-4000-8000-000000000002',(select attempt_id from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000002'),'cs_recover_2','pi_recover_2','session_expired')$q$,'23514','late release failure rolls back inventory coupon and order writes');
select pg_temp.check_recovery((select stock=92 and sales_count=8 from public.products),'failed release preserves inventory');
select pg_temp.check_recovery((select times_used=4 from public.coupons),'failed release preserves coupon usage');
select pg_temp.check_recovery((select status='pending' and inventory_released_at is null from public.orders where id='30000000-0000-4000-8000-000000000002'),'failed release leaves reservation retryable');
reset role;
drop trigger fail_recovery_commit on public.orders;
update public.stripe_checkout_attempts set expires_at=now()-interval '10 minutes' where order_id='30000000-0000-4000-8000-000000000006';
set local role service_role;
select pg_temp.check_recovery(public.release_stripe_reservation('30000000-0000-4000-8000-000000000006',
 (select attempt_id from public.stripe_checkout_attempts where order_id='30000000-0000-4000-8000-000000000006'),
 null,null,'abandoned_attempt')->>'released'='true','absent ambiguous creation releases only after its bounded expiry');
rollback;
