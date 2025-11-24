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