// server/models/Product.js
import { PRODUCT_FIELDS } from "../utils/storefrontFields.js";
import AppError from "../utils/appError.js";

export function catalogPrice(price, discount = 0) {
  const amount = Number(price), percent = Number(discount);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(percent) || percent < 0 || percent > 100) throw new AppError("Invalid product price or discount", 400);
  return Math.round(amount * (1 - percent / 100) * 100) / 100;
}
const requireClient = (client) => {
  if (!client) throw new Error("Supabase client is required");
  return client;
};

/* ===========================================================
   MAP HELPERS
=========================================================== */

export const mapProductRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    specifications: row.specifications,
    originalPrice: Number(row.original_price),
    discountPercentage: Number(row.discount_percentage ?? 0),
    finalPrice: row.final_price != null ? Number(row.final_price) : null,
    stock: row.stock,
    availability: row.availability,
    images: row.images || [],
    description: row.description,
    ratings: row.ratings,
    features: row.features || [],
    warranty: row.warranty,
    weight: row.weight != null ? Number(row.weight) : null,
    dimensions: row.dimensions,
    sku: row.sku,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    salesCount: row.sales_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const mapProductsRows = (rows) =>
  Array.isArray(rows) ? rows.map(mapProductRow) : [];

/* ===========================================================
   BASIC CRUD
=========================================================== */

export const createProduct = async (payload, client) => {
  const db = requireClient(client);
  const dataToInsert = {
    name: payload.name,
    category: payload.category,
    brand: payload.brand,
    specifications: payload.specifications ?? null,
    original_price: payload.originalPrice,
    discount_percentage: payload.discountPercentage ?? 0,
    final_price: catalogPrice(payload.originalPrice, payload.discountPercentage),
    stock: payload.stock ?? 0,
    availability: Number(payload.stock ?? 0) > 0 ? "In Stock" : "Out of Stock",
    images: payload.images ?? [],
    description: payload.description,
    ratings: payload.ratings ?? { average: 0, totalReviews: 0 },
    features: payload.features ?? [],
    warranty: payload.warranty ?? "1 year limited warranty",
    weight: payload.weight ?? null,
    dimensions: payload.dimensions ?? null,
    sku: payload.sku,
    is_active: payload.isActive ?? true,
    is_featured: payload.isFeatured ?? false,
    sales_count: payload.salesCount ?? 0,
  };

  const { data, error } = await db
    .from("products")
    .insert([dataToInsert])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapProductRow(data);
};

export const getProductById = async (id, client) => {
  const db = requireClient(client);
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProductRow(data);
};

export const updateProduct = async (id, updates, client) => {
  const db = requireClient(client);
  if (updates.originalPrice !== undefined || updates.discountPercentage !== undefined) {
    const existing = await getProductById(id, db);
    if (!existing) throw new AppError("Product not found", 404);
    updates = {...updates, finalPrice: catalogPrice(updates.originalPrice ?? existing.originalPrice, updates.discountPercentage ?? existing.discountPercentage)};
  } else {
    updates = {...updates};
    delete updates.finalPrice; // Derived value is never accepted from an API caller.
  }
  const dbUpdates = {
    name: updates.name,
    category: updates.category,
    brand: updates.brand,
    specifications: updates.specifications,
    original_price: updates.originalPrice,
    discount_percentage: updates.discountPercentage,
    final_price: updates.finalPrice,
    stock: updates.stock,
    availability: updates.stock === undefined ? updates.availability : Number(updates.stock) > 0 ? "In Stock" : "Out of Stock",
    images: updates.images,
    description: updates.description,
    ratings: updates.ratings,
    features: updates.features,
    warranty: updates.warranty,
    weight: updates.weight,
    dimensions: updates.dimensions,
    sku: updates.sku,
    is_active: updates.isActive,
    is_featured: updates.isFeatured,
    sales_count: updates.salesCount,
    updated_at: new Date().toISOString(),
  };

  Object.keys(dbUpdates).forEach(
    (key) => dbUpdates[key] === undefined && delete dbUpdates[key]
  );

  const { data, error } = await db
    .from("products")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapProductRow(data);
};

export const deleteProduct = async (id, client) => {
  const db = requireClient(client);
  const { error } = await db.from("products").delete().eq("id", id);

  if (error) throw new Error(error.message);
  return true;
};

export const getAllProductsForAdmin = async (client) => {
  const db = requireClient(client);
  const { data, error } = await db.from("products").select("*");
  if (error) throw new Error(error.message);
  return mapProductsRows(data);
};

/* ===========================================================
   STOCK & SALES RPC
=========================================================== */

export const changeStock = async (productId, delta, client) => {
  const db = requireClient(client);
  const { data, error } = await db.rpc("change_stock", {
    p_product_id: productId,
    p_delta: delta,
  });

  if (error) throw new Error(error.message);
  
  // Return the updated product (optional fetch if UI needs it, but RPC doesn't return the row in this implementation)
  return getProductById(productId, db);
};

export const increaseSales = async (productId, qty, client) => {
  const db = requireClient(client);
  const { data, error } = await db.rpc("increase_sales", {
    p_product_id: productId,
    p_qty: qty,
  });

  if (error) throw new Error(error.message);
  
  return getProductById(productId, db);
};

export const batchChangeStock = async (updates, client) => {
  const db = requireClient(client);
  const payload = Array.isArray(updates) ? updates : [];
  const { error } = await db.rpc("batch_change_stock", {
    p_updates: payload,
  });
  if (error) throw new Error(error.message);
  return true;
};

/* ===========================================================
   RATINGS RECALCULATION
=========================================================== */

export const recalcProductRatings = async (productId, client) => {
  const db = requireClient(client);
  const { data: reviews, error: reviewError } = await db
    .from("reviews")
    .select("rating")
    .eq("product_id", productId)
    .eq("is_active", true);

  if (reviewError) throw new Error(reviewError.message);

  const totalReviews = reviews?.length ?? 0;

  let average = 0;
  if (totalReviews > 0) {
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    average = Number((sum / totalReviews).toFixed(2));
  }

  const ratings = { average, totalReviews };

  const { error: updateError } = await db
    .from("products")
    .update({ ratings })
    .eq("id", productId);

  if (updateError) throw new Error(updateError.message);

  return ratings;
};
