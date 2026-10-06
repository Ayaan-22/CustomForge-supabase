begin;
create function pg_temp.check_analytics(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
insert into public.users(id,name,email,password,is_email_verified) values
 ('10000000-0000-4000-8000-000000000001','Returning','analytics1@example.test','fixture',true),
 ('10000000-0000-4000-8000-000000000002','New','analytics2@example.test','fixture',true);
insert into public.products(id,name,category,brand,original_price,final_price,stock,sku,images,description)
 select gen_random_uuid(),'Analytics product '||n,'CPU','Test',10,10,2,'analytics-'||n,array['test.jpg'],'Test fixture' from generate_series(1,1205) n;
insert into public.orders(user_id,shipping_address,payment_method,items_price,shipping_price,tax_price,total_price,is_paid,status,created_at)
 select '10000000-0000-4000-8000-000000000001','{}','stripe',10,0,0,10,true,'paid',now()-interval '1 day' from generate_series(1,1205);
insert into public.orders(user_id,shipping_address,payment_method,items_price,shipping_price,tax_price,total_price,is_paid,status,created_at) values
 ('10000000-0000-4000-8000-000000000001','{}','stripe',10,0,0,10,true,'paid',now()-interval '60 days'),
 ('10000000-0000-4000-8000-000000000002','{}','stripe',10,0,0,10,true,'paid',now()-interval '1 day');
set local role service_role;
select pg_temp.check_analytics((public.admin_analytics('products')->>'totalProducts')::int=1205,'all products beyond PostgREST cap counted');
select pg_temp.check_analytics((public.admin_analytics('sales')->>'totalOrders')::int=1206,'all paid orders in date range counted');
select pg_temp.check_analytics((public.admin_analytics('sales')->>'totalRevenue')::numeric=12060,'revenue includes rows beyond 1000');
select pg_temp.check_analytics((public.admin_analytics('sales')->'customerStats'->>'returningCustomers')::int=1,'historical paid purchase identifies returning customer');
select pg_temp.check_analytics((public.admin_analytics('sales')->'customerStats'->>'newCustomers')::int=1,'new customer cohort excludes returning customer');
select pg_temp.check_analytics((public.admin_analytics('overview')->'orders'->>'total')::int=1207,'overview includes complete history');
select pg_temp.check_analytics((public.admin_analytics('orders')->>'totalOrders')::int=1206,'order analytics date range exact');
select pg_temp.check_analytics(jsonb_array_length(public.admin_analytics('orders')->'recentOrders')=10,'recent orders bounded in database');
select pg_temp.check_analytics((public.admin_analytics('inventory')->'stockLevels'->>'totalStock')::int=2410,'inventory aggregates complete dataset');
select pg_temp.check_analytics(jsonb_array_length(public.admin_analytics('inventory')->'lowStockProducts')=10,'inventory preview bounded in database');
select pg_temp.check_analytics((public.admin_analytics('users')->>'totalUsers')::int=2,'user counts exact');
select pg_temp.check_analytics((public.admin_analytics('users')->'userGrowth'->0->>'count')::int=2,'daily user chart agrees with database counts');
reset role;
select pg_temp.check_analytics(not has_function_privilege('anon','public.admin_analytics(text,integer,text)','execute'),'anonymous analytics denied');
select pg_temp.check_analytics(not has_function_privilege('authenticated','public.admin_analytics(text,integer,text)','execute'),'customer analytics denied');
select pg_temp.check_analytics(not (select prosecdef from pg_proc where oid='public.admin_analytics(text,integer,text)'::regprocedure),'analytics retains security invoker');
rollback;
