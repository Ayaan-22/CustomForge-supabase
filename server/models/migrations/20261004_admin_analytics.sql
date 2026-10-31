begin;

create index if not exists analytics_orders_created on public.orders(created_at);
create index if not exists analytics_paid_customer_history on public.orders(user_id, created_at)
  where is_paid is true and status not in ('cancelled','refunded');
create index if not exists analytics_order_items_order on public.order_items(order_id);

-- Only the existing privileged admin boundary can execute this read-only RPC.
-- SECURITY INVOKER deliberately retains the invoking role's privileges/RLS.
create or replace function public.admin_analytics(p_kind text, p_days integer default 30, p_period text default 'daily')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  result jsonb;
  start_at timestamptz := now() - make_interval(days => p_days);
  grain text;
begin
  if p_days is null or p_days not between 1 and 365 or p_period is null or p_period not in ('daily','weekly','monthly') then
    raise exception 'Invalid analytics range' using errcode='22023';
  end if;
  grain := case p_period when 'weekly' then 'week' when 'monthly' then 'month' else 'day' end;
  case p_kind
  when 'products' then
    select jsonb_build_object('totalProducts',count(*),'activeProducts',count(*) filter(where is_active),
      'lowStock',count(*) filter(where stock between 1 and 5),'outOfStock',count(*) filter(where stock=0),'growth',null)
    into result from public.products;
  when 'users' then
    select jsonb_build_object('totalUsers',count(*),'activeUsers',count(*) filter(where active),
      'verifiedUsers',count(*) filter(where is_email_verified),'newUsers',count(*) filter(where created_at>=start_at),
      'adminUsers',count(*) filter(where role='admin'),'growth',null,
      'userGrowth',coalesce((select jsonb_agg(to_jsonb(g) order by date) from
        (select to_char(created_at at time zone 'UTC','YYYY-MM-DD') date,count(*) count
         from public.users where created_at>=start_at and created_at<=now() group by 1) g),'[]'::jsonb),
      'period',jsonb_build_object('days',p_days,'startDate',start_at))
    into result from public.users;
  when 'overview' then
    select jsonb_build_object(
      'users',jsonb_build_object('total',(select count(*) from public.users)),
      'products',jsonb_build_object('total',(select count(*) from public.products),
        'lowStock',(select count(*) from public.products where is_active and stock<=5)),
      'orders',jsonb_build_object('total',count(*),'paid',count(*) filter(where is_paid and status not in ('cancelled','refunded')),
        'revenue',coalesce(sum(total_price) filter(where is_paid and status not in ('cancelled','refunded')),0)))
    into result from public.orders;
  when 'orders' then
    with window_orders as (select id,status,is_paid,total_price,created_at,user_id from public.orders where created_at>=start_at and created_at<=now()),
    daily as (select to_char(created_at at time zone 'UTC','YYYY-MM-DD') as date,count(*) as orders,
      count(*) filter(where status='delivered') as delivered from window_orders group by 1),
    statuses as (select status,count(*) as n from window_orders group by status),
    recent as (select id::text as id,'User '||left(user_id::text,8) as customer,total_price as amount,status from window_orders order by created_at desc,id desc limit 10)
    select jsonb_build_object('totalOrders',count(*),'paidOrders',count(*) filter(where is_paid),
      'totalRevenue',coalesce(sum(total_price) filter(where is_paid and status not in ('cancelled','refunded')),0),
      'statusCounts',coalesce((select jsonb_object_agg(status,n) from statuses),'{}'::jsonb),'growth',null,
      'ordersData',coalesce((select jsonb_agg(to_jsonb(daily) order by date) from daily),'[]'::jsonb),
      'recentOrders',coalesce((select jsonb_agg(to_jsonb(recent)) from recent),'[]'::jsonb),
      'period',jsonb_build_object('days',p_days,'startDate',start_at)) into result from window_orders;
  when 'sales' then
    with paid as (select id,user_id,total_price,created_at from public.orders where is_paid and status not in ('cancelled','refunded')),
    window_orders as (select * from paid where created_at>=start_at and created_at<=now()),
    buckets as (select date_trunc(grain,created_at at time zone 'UTC') as bucket,count(*) as orders,sum(total_price) as revenue,
      round(avg(total_price),2) as "avgOrderValue" from window_orders group by 1),
    chart as (select to_char(bucket,'YYYY-MM-DD') as date,orders,revenue,"avgOrderValue" from buckets),
    first_purchase as (select p.user_id,min(p.created_at) as first_at from paid p
      where p.user_id in (select user_id from window_orders) group by p.user_id),
    top_products as (select i.product_id as "productId",max(i.name) as name,sum(i.quantity) as "totalQuantity",
      sum(i.price*i.quantity) as "totalRevenue" from public.order_items i join window_orders o on o.id=i.order_id
      group by i.product_id order by sum(i.price*i.quantity) desc,i.product_id limit 10)
    select jsonb_build_object('totalRevenue',coalesce(sum(total_price),0),'totalOrders',count(*),
      'avgOrderValue',coalesce(round(avg(total_price),2),0),'growth',null,
      'revenueData',coalesce((select jsonb_agg(to_jsonb(chart) order by date) from chart),'[]'::jsonb),
      'topProducts',coalesce((select jsonb_agg(to_jsonb(top_products)) from top_products),'[]'::jsonb),
      'customerStats',(select jsonb_build_object('totalCustomers',count(*),'newCustomers',count(*) filter(where first_at>=start_at),
        'returningCustomers',count(*) filter(where first_at<start_at)) from first_purchase),
      'period',p_period,'range',jsonb_build_object('startDate',start_at,'endDate',now())) into result from window_orders;
  when 'inventory' then
    with categories as (select coalesce(category,'Uncategorized') as category,coalesce(sum(stock),0) as "totalStock",count(*) as "productCount",
      count(*) filter(where stock<=5) as "lowStockCount",coalesce(round(avg(stock)),0) as "avgStock" from public.products group by category),
    low_stock as (select id,name,stock,is_active,sales_count,category,sku from public.products where stock between 1 and 5 order by stock,id limit 10),
    no_stock as (select id,name,stock,is_active,sales_count,category,sku from public.products where stock<=0 order by id limit 10),
    top_selling as (select id,name,stock,is_active,sales_count,category,sku from public.products where sales_count>0 order by sales_count desc,id limit 10)
    select jsonb_build_object('stockLevels',jsonb_build_object('totalStock',coalesce(sum(stock),0),'avgStock',coalesce(round(avg(stock)),0),
      'inStock',count(*) filter(where stock>5),'lowStock',count(*) filter(where stock between 1 and 5),'outOfStock',count(*) filter(where stock<=0)),
      'categoryStock',coalesce((select jsonb_agg(to_jsonb(categories) order by category) from categories),'[]'::jsonb),
      'lowStockProducts',coalesce((select jsonb_agg(to_jsonb(low_stock)) from low_stock),'[]'::jsonb),
      'outOfStockProducts',coalesce((select jsonb_agg(to_jsonb(no_stock)) from no_stock),'[]'::jsonb),
      'topSellingProducts',coalesce((select jsonb_agg(to_jsonb(top_selling)) from top_selling),'[]'::jsonb)) into result from public.products;
  else raise exception 'Unknown analytics section' using errcode='22023';
  end case;
  return result;
end $$;
revoke all on function public.admin_analytics(text,integer,text) from public,anon,authenticated;
grant execute on function public.admin_analytics(text,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
