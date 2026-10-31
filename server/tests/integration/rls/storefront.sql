-- Run only in the disposable database created by run-rls-tests.js.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.assert_denied(statement text, label text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL: permission granted: %', label;
end $$;

insert into public.users(id,name,email,password) values
 ('10000000-0000-4000-8000-000000000001','Owner One','one@example.test','test-only'),
 ('10000000-0000-4000-8000-000000000002','Owner Two','two@example.test','test-only');
insert into public.products(id,name,category,brand,original_price,final_price,stock,images,description,sku,is_active,ratings) values
 ('20000000-0000-4000-8000-000000000001','Public GPU','GPU','Public Brand',100,90,5,'{}','Public hardware','public-1',true,'{"average":4.8,"totalReviews":10}'),
 ('20000000-0000-4000-8000-000000000002','Hidden draft','Secret Category','Secret Brand',500,450,40,'{}','Unpublished hardware','draft-2',false,'{}'),
 ('20000000-0000-4000-8000-000000000003','Unset visibility','Secret Category','Secret Brand',500,450,40,'{}','Unpublished hardware','draft-3',null,'{}');
-- Future private columns must not become readable due to a table-wide grant.
alter table public.products add column supplier_info text default 'private supplier';
alter table public.products add column internal_cost numeric default 10;
alter table public.products add column hidden_stock_metadata jsonb default '{"warehouse":99}';
insert into public.games(product_id,developer,publisher,release_date,age_rating)
 select id,'Studio','Publisher','2026-01-01','Everyone' from public.products;
insert into public.prebuilt_pcs(product_id,name,description,category,cpu,gpu,ram,power_supply,stock,sku)
 select id,name,description,category,'{}','{}','{}','{}',stock,'pc-'||sku from public.products;
insert into public.reviews(id,product_id,user_id,rating,title,comment,is_active,reported,report_reason) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',5,'Public review','Approved public review',true,false,null),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',4,'Pending review','Pending private review',false,false,null),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',3,'Reported review','Reported private review',true,true,'Internal moderation note'),
 ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',5,'Hidden product review','Not public',true,false,null);
insert into public.carts(id,user_id) values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
insert into public.cart_items(cart_id,product_id,quantity)
 select id,'20000000-0000-4000-8000-000000000001',1 from public.carts;
insert into public.user_addresses(user_id,full_name,address,city,state,postal_code,phone_number)
 select id,name,'Private home','City','State','12345','5551234' from public.users;
insert into public.user_payment_methods(user_id,type,card_holder_name,card_number)
 select id,'card',name,'test-only-card' from public.users;
insert into public.user_wishlist(user_id,product_id)
 select id,'20000000-0000-4000-8000-000000000001' from public.users;
insert into public.orders(id,user_id,shipping_address,payment_method,items_price,shipping_price,tax_price,total_price) values
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{}','cod',100,0,0,100),
 ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','{}','cod',100,0,0,100);
insert into public.order_items(order_id,product_id,name,image,price,quantity,price_snapshot)
 select id,'20000000-0000-4000-8000-000000000001','Public GPU','test.png',100,1,100 from public.orders;

set local role anon;
select pg_temp.assert_true((select count(*) = 1 from public.products), 'anon sees exactly one active product');
select pg_temp.assert_true((select count(*) = 1 from public.storefront_products), 'invoker product view enforces visibility');
select pg_temp.assert_true((select count(*) = 1 from public.games), 'game parent visibility');
select pg_temp.assert_true((select count(*) = 1 from public.prebuilt_pcs), 'prebuilt parent visibility');
select pg_temp.assert_true((select count(*) = 1 from public.storefront_games), 'safe game view');
select pg_temp.assert_true((select count(*) = 1 from public.storefront_prebuilt_pcs), 'safe prebuilt view');
select pg_temp.assert_true((select count(*) = 1 from public.reviews), 'anon only approved unreported visible-product reviews');
select pg_temp.assert_true((select count(*) = 1 from public.storefront_reviews), 'safe review view');
select pg_temp.assert_true((select array_agg(category) = array['GPU'] from public.storefront_categories), 'categories exclude hidden inventory');
select pg_temp.assert_true((select array_agg(brand) = array['Public Brand'] from public.storefront_brands), 'brands exclude hidden inventory');
select pg_temp.assert_true((select count(*) = 1 from public.storefront_products where name ilike '%Public%'), 'anonymous search returns products');
select pg_temp.assert_denied('select * from public.products', 'raw wildcard cannot expose private product fields');
select pg_temp.assert_denied('select sales_count from public.products', 'sales analytics stay private');
select pg_temp.assert_denied('select supplier_info, internal_cost, hidden_stock_metadata from public.products', 'new internal columns stay private');
select pg_temp.assert_denied('select user_id from public.reviews', 'anonymous reviewer identity stays private');
select pg_temp.assert_denied('select report_reason from public.reviews', 'moderation notes stay private');
select pg_temp.assert_denied('update public.products set stock=999', 'anonymous catalog mutations denied');
select pg_temp.assert_denied('delete from public.reviews', 'anonymous review mutations denied');
do $$ declare relation text; begin
 foreach relation in array array['users','carts','cart_items','orders','order_items','user_addresses','user_payment_methods','user_wishlist','coupons'] loop
  perform pg_temp.assert_denied(format('select * from public.%I',relation),'anon private table: '||relation);
 end loop;
end $$;

reset role;
-- Even a future accidental table grant or legacy USING(true) cannot open users.
grant select on public.users to anon;
set local role anon;
select pg_temp.assert_true((select count(*) = 0 from public.users), 'private restrictive policy survives an accidental grant');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*) = 1 from public.storefront_products), 'authenticated storefront visibility');
select pg_temp.assert_true((select count(*) = 1 from public.storefront_reviews), 'owner pending review does not leak through public view');
select pg_temp.assert_true((select count(*) = 2 from public.reviews), 'owner can manage own pending review but not other hidden reviews');
do $$ declare relation text; begin
 foreach relation in array array['users','carts','cart_items','orders','order_items','user_addresses','user_payment_methods','user_wishlist'] loop
  execute format('select pg_temp.assert_true((select count(*)=1 from public.%I), %L)',relation,'owner isolation: '||relation);
 end loop;
end $$;
select pg_temp.assert_denied('select internal_cost from public.products', 'authenticated users cannot read internal costs');
select pg_temp.assert_denied('select report_reason from public.reviews', 'authenticated users cannot read moderation notes');
select pg_temp.assert_denied($q$ update public.reviews set is_active=true where id='30000000-0000-4000-8000-000000000002' $q$, 'owner cannot self-approve pending review');
with changed as (update public.reviews set reported=false where id='30000000-0000-4000-8000-000000000003' returning id)
 select pg_temp.assert_true((select count(*)=0 from changed), 'owner cannot change another review moderation');
-- UPDATE on another user's private record must affect zero rows.
with changed as (update public.user_addresses set city='Attacker' where user_id='10000000-0000-4000-8000-000000000002' returning id)
 select pg_temp.assert_true((select count(*)=0 from changed), 'cross-user private writes denied');
insert into public.reviews(product_id,user_id,rating,title,comment,is_active)
 values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',5,'New review','Attempts self-publication',true);
select pg_temp.assert_true((select count(*)=1 from public.storefront_reviews), 'direct API inserts cannot self-publish');
update public.reviews set comment='Edited review requires moderation' where id='30000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*)=0 from public.storefront_reviews), 'edited review awaits re-approval');
reset role;

set local role service_role;
select pg_temp.assert_true((select count(*)=3 from public.products), 'trusted admin backend still sees drafts');
select pg_temp.assert_true((select count(*)=2 from public.users), 'trusted admin backend still manages users');
update public.reviews set is_active=true where id='30000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select is_active from public.reviews where id='30000000-0000-4000-8000-000000000002'), 'trusted admin approval succeeds');
reset role;
set local role anon;
select pg_temp.assert_true((select count(*)=1 from public.storefront_reviews), 'admin-approved review becomes public');
reset role;
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class where oid in ('public.products'::regclass,'public.reviews'::regclass,'public.users'::regclass,'public.orders'::regclass)), 'RLS remains enabled');
rollback;
