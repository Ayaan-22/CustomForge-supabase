begin;
create function pg_temp.check_cancel(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.cancel_error(statement text,code text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then if sqlstate<>code then raise; end if; raise notice 'PASS: %',label; return; end;
raise exception 'FAIL: unexpectedly succeeded: %',label; end $$;
insert into public.users(id,name,email,password,is_email_verified) values
 ('10000000-0000-4000-8000-000000000001','Buyer','cancel@example.test','fixture',true),
 ('10000000-0000-4000-8000-000000000002','Other','other@example.test','fixture',true);
insert into public.products(id,name,category,brand,original_price,stock,sales_count,images,description,sku) values
 ('20000000-0000-4000-8000-000000000001','Product','CPU','Test',10,3,2,'{test.jpg}','Fixture','cancel');
insert into public.orders(id,user_id,shipping_address,payment_method,items_price,shipping_price,tax_price,total_price,is_paid,status) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{}','cod',20,0,0,20,false,'pending');
insert into public.order_items(order_id,product_id,name,image,price,quantity,price_snapshot) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Product','test.jpg',10,2,10);
set local role anon;
select pg_temp.cancel_error($q$select public.cancel_unpaid_order('30000000-0000-4000-8000-000000000001')$q$,'42501','anonymous cancellation denied');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.cancel_error($q$select public.cancel_unpaid_order('30000000-0000-4000-8000-000000000001')$q$,'42501','other customer cancellation denied');
reset role;
update public.orders set payment_method='stripe';
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select pg_temp.cancel_error($q$select public.cancel_unpaid_order('30000000-0000-4000-8000-000000000001')$q$,'P0001','card cancellation requires provider reconciliation');
reset role;
update public.orders set payment_method='cod',is_paid=true;
set local role authenticated;
select pg_temp.cancel_error($q$select public.cancel_unpaid_order('30000000-0000-4000-8000-000000000001')$q$,'P0001','paid cancellation denied');
reset role;
update public.orders set is_paid=false;
create function pg_temp.fail_restock() returns trigger language plpgsql as $$ begin raise exception 'test failure' using errcode='23514'; end $$;
create trigger fail_restock before update on public.products for each row execute function pg_temp.fail_restock();
set local role authenticated;
select pg_temp.cancel_error($q$select public.cancel_unpaid_order('30000000-0000-4000-8000-000000000001')$q$,'23514','restock failure aborts cancellation');
select pg_temp.check_cancel((select status='pending' from public.orders),'restock failure keeps order pending');
reset role;
drop trigger fail_restock on public.products;
set local role authenticated;
select pg_temp.check_cancel(public.cancel_unpaid_order('30000000-0000-4000-8000-000000000001')->>'status'='cancelled','owner cancels unpaid COD');
select pg_temp.check_cancel(public.cancel_unpaid_order('30000000-0000-4000-8000-000000000001')->>'status'='cancelled','cancellation retry is idempotent');
reset role;
select pg_temp.check_cancel((select stock=5 and sales_count=0 from public.products),'inventory restored exactly once');
rollback;
