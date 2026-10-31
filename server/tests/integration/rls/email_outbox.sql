begin;
create function pg_temp.check_outbox(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.outbox_denied(statement text, label text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when insufficient_privilege then raise notice 'PASS: %', label; return;
  end;
  raise exception 'FAIL: unexpectedly allowed %', label;
end;
$$;
insert into public.users(id, name, email, password, is_email_verified)
  values ('10000000-0000-4000-8000-000000000001', 'Buyer', 'outbox@example.test', 'fixture', true);
insert into public.products(id, name, category, brand, original_price, stock, images, description, sku)
  values ('20000000-0000-4000-8000-000000000001', 'CPU', 'CPU', 'Test', 10, 2, '{test.jpg}', 'Fixture', 'outbox-cpu');
insert into public.carts(id, user_id)
  values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
insert into public.cart_items(cart_id, product_id, quantity)
  values ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1);
insert into public.user_addresses(id, user_id, full_name, address, city, state, postal_code, country, phone_number)
  values ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Buyer', '18 Test Street', 'City', 'State', '12345', 'Country', '12345678910');

create function pg_temp.fail_outbox_line() returns trigger language plpgsql as $$
begin raise exception 'line failure' using errcode = '23514'; end;
$$;
create trigger outbox_line_failure before insert on public.order_items
  for each row execute function pg_temp.fail_outbox_line();
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
do $$ begin
  perform public.checkout_cart('70000000-0000-4000-8000-000000000001', null, 'cod', 'outbox-failed-order');
  raise exception 'expected checkout failure';
exception when check_violation then null;
end $$;
reset role;
select pg_temp.check_outbox((select count(*) = 0 from public.order_email_outbox), 'checkout rollback leaves no queued email');
drop trigger outbox_line_failure on public.order_items;
set local role authenticated;
select public.checkout_cart('70000000-0000-4000-8000-000000000001', null, 'cod', 'outbox-stable-order');
select public.checkout_cart('70000000-0000-4000-8000-000000000001', null, 'cod', 'outbox-stable-order');
select pg_temp.outbox_denied('select * from public.order_email_outbox', 'customers cannot read delivery recipients');
select pg_temp.outbox_denied('select public.claim_order_emails(1)', 'customers cannot consume email jobs');
select pg_temp.outbox_denied('select public.renew_order_email_lease(null, null)', 'customers cannot renew email leases');
reset role;
select pg_temp.check_outbox((select count(*) = 1 from public.order_email_outbox), 'checkout and replay queue exactly one email');

create temp table claimed_job as select * from public.claim_order_emails(1);
select pg_temp.check_outbox((select count(*) = 1 from claimed_job), 'worker claims a pending email');
select pg_temp.check_outbox((select count(*) = 0 from public.claim_order_emails(1)), 'active lease prevents concurrent duplicate claim');
select pg_temp.check_outbox(not public.renew_order_email_lease((select id from claimed_job), '00000000-0000-4000-8000-000000000000'), 'wrong lease cannot renew delivery ownership');
update public.order_email_outbox set leased_until = now() + interval '20 seconds';
select pg_temp.check_outbox(public.renew_order_email_lease((select id from claimed_job), (select lease_token from claimed_job)), 'current worker renews delivery ownership');
select pg_temp.check_outbox((select leased_until > now() + interval '1 minute' from public.order_email_outbox), 'renewal extends active delivery lease');
set local role service_role;
select pg_temp.check_outbox(public.renew_order_email_lease((select id from public.order_email_outbox), (select lease_token from public.order_email_outbox)), 'service worker can renew delivery lease');
select pg_temp.outbox_denied('update public.order_email_outbox set completed_at = now()', 'service workers mutate delivery state only through lease RPCs');
reset role;
select pg_temp.check_outbox(not public.finish_order_email((select id from claimed_job), '00000000-0000-4000-8000-000000000000', true), 'stale worker cannot acknowledge someone elses lease');
select pg_temp.check_outbox(public.finish_order_email((select id from claimed_job), (select lease_token from claimed_job), false, 'DELIVERY_FAILED'), 'failed delivery schedules retry');
select pg_temp.check_outbox((select completed_at is null and next_attempt_at > now() from public.order_email_outbox), 'failure stays pending with backoff');
update public.order_email_outbox set next_attempt_at = now() - interval '1 second';
truncate claimed_job;
insert into claimed_job select * from public.claim_order_emails(1);
select pg_temp.check_outbox((select attempts = 2 from claimed_job), 'retry survives worker restart');
update public.order_email_outbox set leased_until = now() - interval '1 second';
select pg_temp.check_outbox(not public.renew_order_email_lease((select id from claimed_job), (select lease_token from claimed_job)), 'expired lease cannot be revived by old worker');
select pg_temp.check_outbox((select count(*) = 1 from public.claim_order_emails(1)), 'expired lease recovers after a crash');
select pg_temp.check_outbox(not public.finish_order_email((select id from claimed_job), (select lease_token from claimed_job), true), 'replaced lease cannot complete a recovered job');
select pg_temp.check_outbox(not public.renew_order_email_lease((select id from claimed_job), (select lease_token from claimed_job)), 'replaced lease cannot renew a recovered job');
select pg_temp.check_outbox(public.finish_order_email((select id from public.order_email_outbox), (select lease_token from public.order_email_outbox), true), 'current worker completes delivery');
select pg_temp.check_outbox((select count(*) = 0 from public.claim_order_emails(1)), 'completed email is never claimed again');
rollback;
