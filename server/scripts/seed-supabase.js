import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.join(process.cwd(), 'server/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Default DNS namespace

const getUUID = (type, oldId) => {
  if (!oldId) return null;
  // Generate deterministic UUID based on type and oldId
  return uuidv5(`${type}:${oldId}`, NAMESPACE);
};

async function cleanup() {
  console.log('🧹 Cleaning up existing data...');
  const tables = [
    'order_items', 'orders', 'reviews', 'user_addresses', 
    'user_payment_methods', 'user_wishlist', 'cart_items', 
    'carts', 'games', 'prebuilt_pcs', 'products', 'coupons', 'users'
  ];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && error.code !== '42P01') { // Ignore table not found errors
      console.warn(`Warning cleaning table ${table}:`, error.message);
    }
  }
}

const readJson = (dir, file) => {
  const filePath = path.join(process.cwd(), dir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : (data.users || data.products || data.orders || []);
    } catch (e) {
      console.error(`Error parsing ${filePath}:`, e.message);
      return [];
    }
  }
  return [];
};

async function seed() {
  console.log('🚀 Starting Supabase Seeding...');
  await cleanup();

  // 1. COLLECT USERS
  const rawUsers = [
    ...readJson('admin/public/mock', 'users.json'),
    ...readJson('client/public/mock', 'users.json'),
    ...readJson('client/mock', 'users.json'),
  ];
  
  const userMap = new Map();
  for (const u of rawUsers) {
    const email = u.email?.toLowerCase();
    if (!email) continue;
    if (!userMap.has(email) || (u.id && u.id.length > 10)) { // Prefer more detailed IDs or first seen
      userMap.set(email, u);
    }
  }

  const usersToInsert = await Promise.all(Array.from(userMap.values()).map(async u => {
    const id = getUUID('users', u.id || u.email);
    const hashedPassword = await bcrypt.hash(u.password || 'password123', 10);
    return {
      id,
      name: u.name || 'Anonymous',
      email: u.email.toLowerCase(),
      password: hashedPassword,
      role: u.role || 'user',
      avatar: u.avatar || null,
      phone: u.phone || null,
      address: u.address || null,
      is_email_verified: u.is_email_verified || u.verified || false,
      active: u.active !== undefined ? u.active : true,
      stripe_customer_id: u.stripe_customer_id || null,
      created_at: u.created_at || u.createdAt || new Date().toISOString(),
    };
  }));

  console.log(`Inserting ${usersToInsert.length} users...`);
  const { error: userError } = await supabase.from('users').upsert(usersToInsert);
  if (userError) console.error('Error seeding users:', userError);

  // 2. COLLECT COUPONS
  const rawCoupons = [
    ...readJson('client/public/mock', 'coupons.json'),
    ...readJson('admin/public/mock', 'coupons.json'),
  ];
  const couponMap = new Map();
  for (const c of rawCoupons) {
    if (!couponMap.has(c.code)) couponMap.set(c.code, c);
  }

  const couponsToInsert = Array.from(couponMap.values()).map(c => {
    return {
      id: getUUID('coupons', c.code),
      code: c.code,
      discount_type: c.type || (c.discount > 100 ? 'fixed' : 'percentage'),
      discount_value: c.discount || c.discount_value || 0,
      min_purchase: c.minOrder || c.min_purchase || 0,
      is_active: true,
      valid_from: new Date().toISOString(),
    };
  });
  console.log(`Inserting ${couponsToInsert.length} coupons...`);
  await supabase.from('coupons').upsert(couponsToInsert);

  // 3. COLLECT PRODUCTS
  const rawProducts = [
    ...readJson('client/public/mock', 'products.json'),
    ...readJson('admin/public/mock', 'products.json'),
    ...readJson('client/mock', 'products.json'),
  ];
  
  const productMap = new Map();
  for (const p of rawProducts) {
    const sku = p.id || p.sku || p.slug;
    if (!sku) continue;
    if (!productMap.has(sku) || (p.description && p.description.length > (productMap.get(sku).description?.length || 0))) {
      productMap.set(sku, p);
    }
  }

  const productsToInsert = Array.from(productMap.entries()).map(([sku, p]) => {
    const id = getUUID('products', sku);
    return {
      id,
      name: p.name,
      category: p.category,
      brand: p.brand || 'Generic',
      sku: p.sku || p.slug || sku,
      original_price: p.originalPrice || p.original_price || p.price || 0,
      discount_percentage: p.discountPercentage || p.discount_percentage || 0,
      final_price: p.finalPrice || p.final_price || p.price || 0,
      stock: p.stock || 0,
      availability: p.availability || 'In Stock',
      images: p.images || (p.image ? [p.image] : []),
      description: p.description || 'No description available',
      specifications: p.specifications || p.specs || {},
      features: p.features || [],
      is_featured: p.isFeatured || p.featured || false,
      is_active: p.isActive !== undefined ? p.isActive : (p.is_active !== undefined ? p.is_active : true),
      sales_count: p.salesCount || p.sales_count || 0,
      created_at: p.createdAt || p.created_at || new Date().toISOString(),
    };
  });

  console.log(`Inserting ${productsToInsert.length} products...`);
  const { error: prodError } = await supabase.from('products').upsert(productsToInsert);
  if (prodError) console.error('Error seeding products:', prodError);

  // 4. USER ADDRESSES
  const rawAddresses = readJson('client/public/mock', 'addresses.json');
  const addressesToInsert = rawAddresses.map(a => ({
    user_id: getUUID('users', a.userId),
    label: a.label || 'Home',
    full_name: a.fullName || 'Demo User',
    address: a.line1 + (a.line2 ? `, ${a.line2}` : ''),
    city: a.city,
    state: a.state,
    postal_code: a.postalCode,
    country: a.country || 'USA',
    phone_number: a.phone || '555-0123',
    is_default: a.isDefault || false,
  }));
  console.log(`Inserting ${addressesToInsert.length} addresses...`);
  await supabase.from('user_addresses').upsert(addressesToInsert);

  // 5. REVIEWS
  const rawReviews = readJson('client/public/mock', 'reviews.json');
  const reviewsToInsert = rawReviews.map(r => ({
    product_id: getUUID('products', r.productId),
    user_id: getUUID('users', r.userId),
    rating: r.rating,
    title: r.title || 'Review',
    comment: r.comment,
    verified_purchase: true,
    created_at: r.createdAt || new Date().toISOString(),
  })).filter(r => r.user_id && r.product_id); // Ensure links exist
  console.log(`Inserting ${reviewsToInsert.length} reviews...`);
  await supabase.from('reviews').upsert(reviewsToInsert);

  // 6. ORDERS & ORDER ITEMS
  const rawOrders = [
    ...readJson('client/public/mock', 'orders.json'),
    ...readJson('admin/public/mock', 'orders.json'),
  ];
  
  console.log(`Processing ${rawOrders.length} orders...`);
  for (const o of rawOrders) {
    const orderId = getUUID('orders', o.id);
    const userId = getUUID('users', o.userId || o.user_id);
    
    if (!userId) continue;

    const orderData = {
      id: orderId,
      user_id: userId,
      shipping_address: o.shipping_address || o.shippingAddress || { address: 'Default Address' },
      payment_method: o.payment_method || o.paymentMethod || 'Credit Card',
      items_price: o.subtotal || o.total || 0,
      discount_amount: o.discount || 0,
      shipping_price: 0,
      tax_price: 0,
      total_price: o.total || 0,
      status: o.status || 'pending',
      created_at: o.createdAt || o.created_at || new Date().toISOString(),
    };

    const { error: ordError } = await supabase.from('orders').upsert(orderData);
    if (ordError) {
      console.error(`Error inserting order ${o.id}:`, ordError);
      continue;
    }

    const items = o.items || [];
    const orderItemsToInsert = items.map((item, index) => ({
      id: getUUID('order_items', `${o.id}:${index}`),
      order_id: orderId,
      product_id: getUUID('products', item.productId || item.product),
      name: item.name || 'Product',
      image: item.image || '',
      price: item.price || 0,
      quantity: item.quantity || 1,
      price_snapshot: item.price || 0,
    })).filter(i => i.product_id);

    if (orderItemsToInsert.length > 0) {
      await supabase.from('order_items').upsert(orderItemsToInsert);
    }
  }

  console.log('✅ Seeding completed!');
}

seed().catch(err => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
