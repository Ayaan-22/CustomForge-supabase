-- Disposable database only. Every fixture and checkout is rolled back.
begin;
create function pg_temp.assert_checkout(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_checkout_error(statement text, code text, label text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate <> code then raise; end if;
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL: unexpectedly succeeded: %', label;
end $$;
insert into public.users(id,name,email,password,is_email_verified) values
 ('10000000-0000-4000-8000-000000000001','Buyer','buyer@example.test','fixture',true),
 ('10000000-0000-4000-8000-000000000002','Other','other@example.test','fixture',true),
 ('10000000-0000-4000-8000-000000000003','Unverified','unverified@example.test','fixture',false);
insert into public.products(id,name,category,brand,original_price,final_price,stock,images,description,sku) values
 ('20000000-0000-4000-8000-000000000001','Test board','Motherboard','Test',179,161.1,5,'{test.jpg}','Fixture','checkout-board');
insert into public.coupons(id,code,discount_type,discount_value,usage_limit,per_user_limit) values
 ('60000000-0000-4000-8000-000000000001','TEST10','percentage',10,1,1);
insert into public.carts(id,user_id,coupon_id) values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',null);
insert into public.cart_items(cart_id,product_id,quantity) select id,'20000000-0000-4000-8000-000000000001',2 from public.carts;
insert into public.user_addresses(id,user_id,full_name,address,city,state,postal_code,country,phone_number) values
 ('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Buyer','18 Test Street','city','state','12345','country','12345678910'),
 ('70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Other','18 Test Street','city','state','12345','country','12345678910');

set local role anon;
select pg_temp.expect_checkout_error($q$select public.checkout_cart()$q$,'42501','anonymous checkout denied');
reset role;
set local role authenticated;
select pg_temp.expect_checkout_error($q$select public.checkout_cart()$q$,'42501','missing subject denied');
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
select pg_temp.expect_checkout_error($q$select public.checkout_cart()$q$,'42501','unverified account denied');
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select pg_temp.expect_checkout_error($q$select public.checkout_cart('70000000-0000-4000-8000-000000000002',null,'cod','checkout-other')$q$,'22023','another users shipping address denied');
select pg_temp.expect_checkout_error($q$select public.checkout_cart(null,'{}','cod','checkout-invalid')$q$,'22023','incomplete shipping address denied');

-- Fail after the header has been inserted to prove no orphan survives.
reset role;
create function pg_temp.fail_line_insert() returns trigger language plpgsql as $$
begin raise exception 'Simulated line insert failure' using errcode='23514'; end $$;
create trigger checkout_test_failure before insert on public.order_items for each row execute function pg_temp.fail_line_insert();
set local role authenticated;
select pg_temp.expect_checkout_error($q$select public.checkout_cart('70000000-0000-4000-8000-000000000001',null,'cod','checkout-rollback')$q$,'23514','line insert failure rolls back transaction');
select pg_temp.assert_checkout((select count(*)=0 from public.orders),'no orphan header after failure');
select pg_temp.assert_checkout((select count(*)=1 from public.cart_items),'failed checkout keeps cart');
reset role;
drop trigger checkout_test_failure on public.order_items;
select pg_temp.assert_checkout((select stock=5 and sales_count=0 from public.products),'failed checkout keeps stock and sales');
select pg_temp.assert_checkout((select times_used=0 from public.coupons),'failed checkout keeps coupon usage');

-- Fail at the final write, after stock/coupon/order mutations have happened.
create trigger checkout_late_failure before update on public.carts for each row execute function pg_temp.fail_line_insert();
set local role authenticated;
select pg_temp.expect_checkout_error($q$select public.checkout_cart('70000000-0000-4000-8000-000000000001',null,'cod','checkout-late-failure')$q$,'23514','late failure rolls back all checkout writes');
reset role;
drop trigger checkout_late_failure on public.carts;
select pg_temp.assert_checkout((select count(*)=0 from public.orders),'late failure removes order header');
select pg_temp.assert_checkout((select count(*)=0 from public.order_items),'late failure removes line items');
select pg_temp.assert_checkout((select stock=5 and sales_count=0 from public.products),'late failure restores stock and sales');
select pg_temp.assert_checkout((select times_used=0 from public.coupons),'late failure restores coupon usage');
select pg_temp.assert_checkout((select count(*)=2 from public.cart_items),'late failure restores cleared cart items');

set local role authenticated;
do $$ declare result jsonb; replay jsonb; begin
 result := public.checkout_cart('70000000-0000-4000-8000-000000000001',null,'cod','checkout-success');
 perform pg_temp.assert_checkout(result->>'reused'='false','checkout succeeds through restricted function');
 perform pg_temp.assert_checkout(result#>>'{order,user_id}'=auth.uid()::text,'owner derived from signed subject');
 perform pg_temp.assert_checkout((result#>>'{order,total_price}')::numeric=318.98,'database calculates catalog prices discount and tax');
 perform pg_temp.assert_checkout(jsonb_array_length(result#>'{order,orderItems}')=1,'response contains order items');
 perform pg_temp.assert_checkout((result#>>'{order,is_paid}')::boolean=false,'checkout cannot mark order paid');
 replay := public.checkout_cart('70000000-0000-4000-8000-000000000001',null,'cod','checkout-success');
 perform pg_temp.assert_checkout(replay->>'reused'='true' and replay#>>'{order,id}'=result#>>'{order,id}','same key returns same order after cart cleared');
end $$;
select pg_temp.assert_checkout((select count(*)=1 from public.orders),'one order only');
select pg_temp.assert_checkout((select count(*)=0 from public.cart_items),'successful checkout clears own cart');
select pg_temp.expect_checkout_error($q$insert into public.order_items(order_id,product_id,name,image,price,quantity,price_snapshot) select id,'20000000-0000-4000-8000-000000000001','Forged','x',0,1,0 from public.orders$q$,'42501','direct line price forgery remains denied');
reset role;
select pg_temp.assert_checkout((select stock=3 and sales_count=2 from public.products),'stock and sales change exactly once');
select pg_temp.assert_checkout((select times_used=1 from public.coupons),'coupon consumed exactly once');
select pg_temp.assert_checkout((select count(*)=1 from public.cart_items),'other users cart preserved');
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select pg_temp.assert_checkout((select count(*)=0 from public.orders),'other user cannot read new order');
select pg_temp.assert_checkout((select count(*)=0 from public.order_items),'other user cannot read new line items');
reset role;
update public.products set stock=1;
set local role authenticated;
select pg_temp.expect_checkout_error($q$select public.checkout_cart('70000000-0000-4000-8000-000000000002',null,'cod','checkout-stock')$q$,'P0001','insufficient inventory rejected');
select pg_temp.assert_checkout((select count(*)=0 from public.orders),'stock conflict creates no order');
reset role;
update public.products set stock=5, is_active=false;
set local role authenticated;
select pg_temp.expect_checkout_error($q$select public.checkout_cart('70000000-0000-4000-8000-000000000002',null,'cod','checkout-hidden')$q$,'22023','hidden product cannot be purchased');
reset role;
update public.products set is_active=true;
update public.carts set coupon_id='60000000-0000-4000-8000-000000000001' where user_id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.expect_checkout_error($q$select public.checkout_cart('70000000-0000-4000-8000-000000000002',null,'cod','checkout-coupon')$q$,'22023','exhausted coupon rejected');
reset role;
select pg_temp.assert_checkout((select count(*)=1 from public.orders),'failed attempts create no additional headers');

-- Match the HTTP cart preview cases against actual checkout RPC results.
insert into public.coupons(id,code,discount_type,discount_value) values
 ('60000000-0000-4000-8000-000000000010','PREVIEW10','percentage',10);
do $$ declare n integer; product uuid; buyer uuid; cart uuid; price numeric; begin
 for n in 1..7 loop
  buyer := ('10000000-0000-4000-8000-00000000001' || n)::uuid;
  product := ('20000000-0000-4000-8000-00000000001' || n)::uuid;
  cart := ('40000000-0000-4000-8000-00000000001' || n)::uuid;
  price := (array[383.10,99.99,100,0.05,0,100,0.15]::numeric[])[n];
  insert into public.users(id,name,email,password,is_email_verified) values(buyer,'Preview buyer','preview'||n||'@example.test','fixture',true);
  insert into public.products(id,name,category,brand,original_price,final_price,stock,images,description,sku)
   values(product,'Preview CPU','CPU','Test',price,price,5,'{test.jpg}','Fixture','preview-'||n);
  insert into public.carts(id,user_id,coupon_id) values(cart,buyer,case when n>=6 then '60000000-0000-4000-8000-000000000010'::uuid else null end);
  insert into public.cart_items(cart_id,product_id,quantity) values(cart,product,1);
 end loop;
end $$;
set local role authenticated;
do $$ declare n integer; result jsonb; expected numeric; begin
 for n in 1..7 loop
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-00000000001'||n,true);
  result := public.checkout_cart(null,'{"fullName":"Preview Buyer","address":"18 Test Street","city":"Karachi","state":"Sindh","postalCode":"12345","country":"Pakistan"}'::jsonb,'cod','preview-case-'||n);
  expected := (array[421.41,119.99,110,10.06,10,109,10.14]::numeric[])[n];
  perform pg_temp.assert_checkout((result#>>'{order,total_price}')::numeric=expected,'cart-preview pricing parity case '||n);
 end loop;
end $$;
reset role;
rollback;
