-- Security hardening migration:
-- 1) Refresh token rotation storage
-- 2) Mandatory RLS on all app tables
-- 3) Least-privilege policies
-- 4) Required performance indexes from audit

alter table if exists users
  add column if not exists refresh_token_hash text,
  add column if not exists refresh_token_expires timestamptz;

create index if not exists idx_users_refresh_token_expires
  on users(refresh_token_expires);

-- Performance indexes
create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_reviews_product_id on reviews(product_id);
create index if not exists idx_cart_items_cart_id on cart_items(cart_id);

create or replace function batch_change_stock(p_updates jsonb)
returns void as $$
declare
  item jsonb;
  touched_ids uuid[] := '{}';
begin
  for item in select * from jsonb_array_elements(p_updates)
  loop
    touched_ids := array_append(touched_ids, (item->>'productId')::uuid);
    update products
    set
      stock = stock + coalesce((item->>'delta')::int, 0),
      sales_count = sales_count + coalesce((item->>'quantity')::int, 0),
      updated_at = now()
    where id = (item->>'productId')::uuid;
  end loop;

  if exists (
    select 1
    from products
    where id = any(touched_ids)
      and stock < 0
  ) then
    raise exception 'Insufficient stock in one or more products';
  end if;
end;
$$ language plpgsql;

-- Enable RLS everywhere
alter table users enable row level security;
alter table user_addresses enable row level security;
alter table user_payment_methods enable row level security;
alter table products enable row level security;
alter table games enable row level security;
alter table prebuilt_pcs enable row level security;
alter table user_wishlist enable row level security;
alter table reviews enable row level security;
alter table coupons enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- USERS
drop policy if exists users_self_select on users;
create policy users_self_select on users
for select
using (auth.uid() = id);

drop policy if exists users_self_update on users;
create policy users_self_update on users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- USER ADDRESSES
drop policy if exists user_addresses_owner_all on user_addresses;
create policy user_addresses_owner_all on user_addresses
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- USER PAYMENT METHODS
drop policy if exists user_payment_methods_owner_all on user_payment_methods;
create policy user_payment_methods_owner_all on user_payment_methods
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- PRODUCTS/GAMES/PREBUIILTS public read, admin write via service role
drop policy if exists products_public_read on products;
create policy products_public_read on products
for select
using (true);

drop policy if exists games_public_read on games;
create policy games_public_read on games
for select
using (true);

drop policy if exists prebuilt_pcs_public_read on prebuilt_pcs;
create policy prebuilt_pcs_public_read on prebuilt_pcs
for select
using (true);

-- WISHLIST
drop policy if exists user_wishlist_owner_all on user_wishlist;
create policy user_wishlist_owner_all on user_wishlist
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- REVIEWS public read active, owner write
drop policy if exists reviews_public_read on reviews;
create policy reviews_public_read on reviews
for select
using (is_active = true);

drop policy if exists reviews_owner_write on reviews;
create policy reviews_owner_write on reviews
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- COUPONS public read active
drop policy if exists coupons_public_read on coupons;
create policy coupons_public_read on coupons
for select
using (is_active = true);

-- CARTS
drop policy if exists carts_owner_all on carts;
create policy carts_owner_all on carts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- CART ITEMS (join through carts ownership)
drop policy if exists cart_items_owner_all on cart_items;
create policy cart_items_owner_all on cart_items
for all
using (
  exists (
    select 1
    from carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
);

-- ORDERS
drop policy if exists orders_owner_all on orders;
create policy orders_owner_all on orders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ORDER ITEMS (join through order ownership)
drop policy if exists order_items_owner_read on order_items;
create policy order_items_owner_read on order_items
for select
using (
  exists (
    select 1
    from orders o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);

