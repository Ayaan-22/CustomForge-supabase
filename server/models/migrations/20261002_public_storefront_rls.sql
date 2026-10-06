-- Apply after schema.sql and 20260430_security_hardening.sql. PostgreSQL 15+.
-- The checked-in schema uses is_active as its product publication switch.
-- Inactive/NULL products are drafts/hidden. Categories and brands are columns,
-- not independent tables. No policy is granted on an unknown metadata table.
begin;

alter table public.products enable row level security;
alter table public.games enable row level security;
alter table public.prebuilt_pcs enable row level security;
alter table public.reviews enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon, authenticated
  using (is_active is true);
-- Restrictive guards prevent a legacy permissive USING(true) from widening reads.
drop policy if exists storefront_products_visible on public.products;
create policy storefront_products_visible on public.products as restrictive
  for select to anon, authenticated using (is_active is true);

drop policy if exists games_public_read on public.games;
create policy games_public_read on public.games for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active is true));
drop policy if exists storefront_games_visible on public.games;
create policy storefront_games_visible on public.games as restrictive for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active is true));

drop policy if exists prebuilt_pcs_public_read on public.prebuilt_pcs;
create policy prebuilt_pcs_public_read on public.prebuilt_pcs for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active is true));
drop policy if exists storefront_prebuilts_visible on public.prebuilt_pcs;
create policy storefront_prebuilts_visible on public.prebuilt_pcs as restrictive for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active is true));

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews for select to anon, authenticated
  using (is_active is true and reported is false and exists (
    select 1 from public.products p where p.id = product_id and p.is_active is true));
drop policy if exists storefront_reviews_anon_visible on public.reviews;
create policy storefront_reviews_anon_visible on public.reviews as restrictive for select to anon
  using (is_active is true and reported is false and exists (
    select 1 from public.products p where p.id = product_id and p.is_active is true));
-- Preserve owners' ability to manage their own pending/removed reviews.
drop policy if exists storefront_reviews_authenticated_visible on public.reviews;
create policy storefront_reviews_authenticated_visible on public.reviews as restrictive for select to authenticated
  using ((select auth.uid()) = user_id or (is_active is true and reported is false and exists (
    select 1 from public.products p where p.id = product_id and p.is_active is true)));

-- RLS controls rows, not columns. Remove table-wide SELECT and any old column
-- grants, then grant only the reviewed allowlists. Future columns stay private.
do $$
declare relation text; columns text;
begin
  foreach relation in array array['products', 'games', 'prebuilt_pcs', 'reviews'] loop
    execute format('revoke select on public.%I from public, anon, authenticated', relation);
    select string_agg(quote_ident(attname), ', ') into columns from pg_attribute
      where attrelid = format('public.%I', relation)::regclass and attnum > 0 and not attisdropped;
    execute format('revoke select (%s) on public.%I from public, anon, authenticated', columns, relation);
    -- Anonymous requests must never mutate catalog data, even via old grants.
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon', relation);
    execute format('revoke insert (%s), update (%s), references (%s) on public.%I from public, anon', columns, columns, columns, relation);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select (id, name, category, brand, specifications, original_price,
  discount_percentage, final_price, stock, availability, images, description,
  ratings, features, warranty, weight, dimensions, sku, is_active, is_featured,
  created_at, updated_at) on public.products to anon, authenticated;
grant select (id, product_id, genre, platform, developer, publisher, release_date,
  age_rating, multiplayer, system_requirements, languages, edition, metacritic_score,
  features, ratings_average, ratings_total_reviews, created_at, updated_at)
  on public.games to anon, authenticated;
grant select (id, product_id, name, description, category, cpu, gpu, motherboard,
  ram, storage, power_supply, pc_case, cooling_system, operating_system,
  warranty_period, images, stock, ratings, features, sku, created_at, updated_at)
  on public.prebuilt_pcs to anon, authenticated;
grant select (id, product_id, game_id, rating, title, comment, verified_purchase,
  helpful_votes, media, platform, playtime_hours, is_active, reported, created_at, updated_at)
  on public.reviews to anon, authenticated;
-- Needed only by owner-scoped mutation queries, never by anonymous readers.
grant select (user_id) on public.reviews to authenticated;

-- Invoker views retain the caller's RLS and column privileges. No service role,
-- SECURITY DEFINER, users join, or SELECT * participates in the public surface.
create or replace view public.storefront_products with (security_invoker = true, security_barrier = true) as
select id, name, category, brand, specifications, original_price, discount_percentage,
  final_price, stock, availability, images, description, ratings, features, warranty,
  weight, dimensions, sku, is_active, is_featured, created_at, updated_at
from public.products where is_active is true;

create or replace view public.storefront_games with (security_invoker = true, security_barrier = true) as
select g.id, g.product_id, g.genre, g.platform, g.developer, g.publisher, g.release_date,
  g.age_rating, g.multiplayer, g.system_requirements, g.languages, g.edition,
  g.metacritic_score, g.features, g.ratings_average, g.ratings_total_reviews, g.created_at, g.updated_at
from public.games g where exists (select 1 from public.products p where p.id = g.product_id and p.is_active is true);

create or replace view public.storefront_prebuilt_pcs with (security_invoker = true, security_barrier = true) as
select pc.id, pc.product_id, pc.name, pc.description, pc.category, pc.cpu, pc.gpu,
  pc.motherboard, pc.ram, pc.storage, pc.power_supply, pc.pc_case, pc.cooling_system,
  pc.operating_system, pc.warranty_period, pc.images, pc.stock, pc.ratings, pc.features,
  pc.sku, pc.created_at, pc.updated_at
from public.prebuilt_pcs pc where exists (select 1 from public.products p where p.id = pc.product_id and p.is_active is true);

create or replace view public.storefront_reviews with (security_invoker = true, security_barrier = true) as
select r.id, r.product_id, r.game_id, r.rating, r.title, r.comment, r.verified_purchase,
  r.helpful_votes, r.media, r.platform, r.playtime_hours, r.created_at, r.updated_at
from public.reviews r where r.is_active is true and r.reported is false
  and exists (select 1 from public.products p where p.id = r.product_id and p.is_active is true);

create or replace view public.storefront_categories with (security_invoker = true, security_barrier = true) as
select distinct category from public.products where is_active is true and category is not null;
create or replace view public.storefront_brands with (security_invoker = true, security_barrier = true) as
select distinct brand from public.products where is_active is true and brand is not null;

revoke all on public.storefront_products, public.storefront_games, public.storefront_prebuilt_pcs,
  public.storefront_reviews, public.storefront_categories, public.storefront_brands from public, anon, authenticated;
grant select on public.storefront_products, public.storefront_games, public.storefront_prebuilt_pcs,
  public.storefront_reviews, public.storefront_categories, public.storefront_brands to anon, authenticated;

-- Keep private tables fail-closed for anon without changing authenticated owner
-- policies or service_role admin access. Revoke column grants as well as tables.
do $$
declare relation text; columns text;
begin
  foreach relation in array array['users', 'user_addresses', 'user_payment_methods',
    'user_wishlist', 'carts', 'cart_items', 'orders', 'order_items', 'coupons'] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('revoke all on public.%I from public, anon', relation);
    select string_agg(quote_ident(attname), ', ') into columns from pg_attribute
      where attrelid = format('public.%I', relation)::regclass and attnum > 0 and not attisdropped;
    execute format('revoke select (%s), insert (%s), update (%s), references (%s) on public.%I from public, anon',
      columns, columns, columns, columns, relation);
    execute format('drop policy if exists storefront_deny_anon on public.%I', relation);
    execute format('create policy storefront_deny_anon on public.%I as restrictive for all to anon using (false) with check (false)', relation);
  end loop;
end $$;

-- Re-moderation cannot be bypassed by an owner talking directly to PostgREST.
-- Existing public reviews remain public; new submissions are pending approval.
alter table public.reviews alter column is_active set default false;
create or replace function public.guard_review_publication() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if TG_OP = 'INSERT' then
      NEW.is_active := false;
      NEW.reported := false;
      NEW.report_reason := null;
    else
      if (NEW.is_active is true and OLD.is_active is not true)
        or NEW.reported is distinct from OLD.reported
        or NEW.report_reason is distinct from OLD.report_reason then
        raise exception 'Review publication and moderation require admin access' using errcode = '42501';
      end if;
      if (NEW.product_id, NEW.game_id, NEW.rating, NEW.title, NEW.comment, NEW.media, NEW.platform, NEW.playtime_hours)
        is distinct from (OLD.product_id, OLD.game_id, OLD.rating, OLD.title, OLD.comment, OLD.media, OLD.platform, OLD.playtime_hours) then
        NEW.is_active := false;
      end if;
    end if;
  end if;
  return NEW;
end $$;
revoke all on function public.guard_review_publication() from public, anon, authenticated;
drop trigger if exists guard_review_publication on public.reviews;
create trigger guard_review_publication before insert or update on public.reviews
  for each row execute function public.guard_review_publication();

notify pgrst, 'reload schema';
commit;
