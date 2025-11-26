-- ===========================================
-- EXTENSIONS
-- ===========================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ===========================================
-- USERS
-- ===========================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  role text default 'user',
  avatar text,
  phone text,
  address text,
  is_email_verified boolean default false,
  email_verification_token text,
  email_verification_expires timestamptz,
  password_reset_token text,
  password_reset_expires timestamptz,
  password_changed_at timestamptz,
  two_factor_enabled boolean default false,
  two_factor_secret text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- USER ADDRESSES
-- ===========================================
create table if not exists user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  label text default 'Home',
  full_name text not null,
  address text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  country text default 'United States',
  phone_number text not null,
  is_default boolean default false
);

-- ===========================================
-- USER PAYMENT METHODS
-- ===========================================
create table if not exists user_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null,
  card_holder_name text,
  card_number text,
  expiry_month int,
  expiry_year int,
  billing_address jsonb,
  is_default boolean default false
);

-- ===========================================
-- USER WISHLIST
-- ===========================================
create table if not exists user_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  unique (user_id, product_id)
);

-- ===========================================
-- PRODUCTS
-- ===========================================
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  brand text not null,
  specifications jsonb,
  original_price numeric not null,
  discount_percentage numeric default 0,
  final_price numeric,
  stock int not null,
  availability text default 'In Stock',
  images text[] not null,
  description text not null,
  ratings jsonb default '{"average":0,"totalReviews":0}',
  features text[],
  warranty text default '1 year limited warranty',
  weight numeric,
  dimensions jsonb,
  sku text unique not null,
  is_active boolean default true,
  is_featured boolean default false,
  sales_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- GAMES
-- ===========================================
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  product_id uuid unique references products(id) on delete cascade,
  genre text[],
  platform text[],
  developer text not null,
  publisher text not null,
  release_date date not null,
  age_rating text not null,
  multiplayer text,
  system_requirements jsonb,
  languages jsonb,
  edition text,
  metacritic_score numeric,
  features jsonb,
  ratings_average numeric default 0,
  ratings_total_reviews int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- PREBUILT PCS
-- ===========================================
create table if not exists prebuilt_pcs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid unique references products(id) on delete cascade,
  name text not null,
  description text not null,
  category text not null,
  cpu jsonb not null,
  gpu jsonb not null,
  motherboard jsonb,
  ram jsonb not null,
  storage jsonb,
  power_supply jsonb not null,
  pc_case jsonb,
  cooling_system jsonb,
  operating_system text,
  warranty_period int,
  images text[],
  stock int not null,
  ratings jsonb,
  features text[],
  sku text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- REVIEWS
-- ===========================================
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  game_id uuid references games(id),
  user_id uuid references users(id),
  rating numeric not null,
  title text not null,
  comment text not null,
  verified_purchase boolean default false,
  helpful_votes int default 0,
  reported boolean default false,
  report_reason text,
  media text[],
  platform text,
  playtime_hours int,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- COUPONS
-- ===========================================
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null,
  discount_value numeric not null,
  min_purchase numeric default 0,
  max_discount numeric,
  valid_from timestamptz default now(),
  valid_to timestamptz,
  is_active boolean default true,
  usage_limit int,
  times_used int default 0,
  per_user_limit int,
  applicable_products uuid[],
  excluded_products uuid[],
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- CARTS
-- ===========================================
create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  coupon_id uuid references coupons(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CART ITEMS
create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid references carts(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  quantity int not null,
  added_at timestamptz default now(),
  unique (cart_id, product_id)
);

-- ===========================================
-- ORDERS
-- ===========================================
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  shipping_address jsonb not null,
  payment_method text not null,
  payment_result jsonb,
  items_price numeric not null,
  discount_amount numeric default 0,
  shipping_price numeric not null,
  tax_price numeric not null,
  total_price numeric not null,
  coupon_applied jsonb,
  is_paid boolean default false,
  paid_at timestamptz,
  is_delivered boolean default false,
  delivered_at timestamptz,
  status text default 'pending',
  notes text,
  idempotency_key text unique,
  return_requested_at timestamptz,
  return_status text default 'none',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ORDER ITEMS
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  name text not null,
  image text not null,
  price numeric not null,
  quantity int not null,
  price_snapshot numeric not null
);

-- Migration: Add stripe_customer_id and payment_methods to users table
-- Run this in your Supabase SQL editor

-- Add stripe_customer_id column (for storing Stripe customer ID)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add payment_methods column (for storing payment method metadata as JSONB)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT NULL;

-- Create index on stripe_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Add comment to columns
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for payment processing';
COMMENT ON COLUMN users.payment_methods IS 'Stored payment methods metadata (JSONB)';
