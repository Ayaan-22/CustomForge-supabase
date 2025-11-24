// server/models/Product.js
import { supabase } from "../config/db.js";

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

export const createProduct = async (payload) => {
  const dataToInsert = {
    name: payload.name,
    category: payload.category,
    brand: payload.brand,
    specifications: payload.specifications ?? null,
    original_price: payload.originalPrice,
    discount_percentage: payload.discountPercentage ?? 0,
    final_price: payload.finalPrice ?? null,
    stock: payload.stock ?? 0,
    availability: payload.availability ?? "In Stock",
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

  const { data, error } = await supabase
    .from("products")
    .insert([dataToInsert])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapProductRow(data);
};

export const getProductById = async (id) => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProductRow(data);
};

export const updateProduct = async (id, updates) => {
  const dbUpdates = {
    name: updates.name,
    category: updates.category,
    brand: updates.brand,
    specifications: updates.specifications,
    original_price: updates.originalPrice,
    discount_percentage: updates.discountPercentage,
    final_price: updates.finalPrice,
    stock: updates.stock,
    availability: updates.availability,
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

  const { data, error } = await supabase
    .from("products")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapProductRow(data);
};

export const deleteProduct = async (id) => {
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) throw new Error(error.message);
  return true;
};

export const getAllProductsForAdmin = async () => {
  const { data, error } = await supabase.from("products").select("*");
  if (error) throw new Error(error.message);
  return mapProductsRows(data);
};

/* ===========================================================
   STOCK & SALES RPC
=========================================================== */

export const changeStock = async (productId, delta) => {
  const { data, error } = await supabase.rpc("update_product_stock", {
    p_product_id: productId,
    p_delta: delta,
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapProductRow(row) : null;
};

export const increaseSales = async (productId, qty) => {
  const { data, error } = await supabase.rpc("increment_product_sales", {
    p_product_id: productId,
    p_qty: qty,
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapProductRow(row) : null;
};

/* ===========================================================
   RATINGS RECALCULATION
=========================================================== */

export const recalcProductRatings = async (productId) => {
  const { data: reviews, error: reviewError } = await supabase
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

  const { error: updateError } = await supabase
    .from("products")
    .update({ ratings })
    .eq("id", productId);

  if (updateError) throw new Error(updateError.message);

  return ratings;
};
