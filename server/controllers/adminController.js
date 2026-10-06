import { publicUser } from "../utils/publicUser.js";
// server/controllers/adminController.js

import asyncHandler from "express-async-handler";
import { getServiceClient } from "../config/db.js";
import AppError from "../utils/appError.js";
import { quotePostgrestFilterValue } from "../utils/postgrestFilters.js";
import { logger } from "../middleware/logger.js";
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";

import {
  createUser as createUserRepo,
  findUserById,
  findUserByEmail,
  updateUser as updateUserRepo,
} from "../models/User.js";

import {
  createProduct as createProductRepo,
  getProductById,
  updateProduct as updateProductRepo,
  deleteProduct as deleteProductRepo,
  recalcProductRatings,
  getAllProductsForAdmin,
} from "../models/Product.js";

import {
  getOrderById,
  markOrderPaid as markOrderPaidRepo,
} from "../models/Order.js";

import {
  createReview,
  updateReview,
  softDeleteReview,
} from "../models/Review.js";

const supabase = getServiceClient();

/* ============================================================================
   UTILITY HELPERS
============================================================================ */

const isValidUUID = (value) =>
  typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);

/**
 * Ensure admin access
 */
const ensureAdmin = (req) => {
  if (!req.user || req.user.role !== "admin") {
    throw new AppError("Admin access only", 403);
  }
};

/**
 * Validate and sanitize pagination parameters
 */
const validatePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Escape regex special characters (used for search)
 */
const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build a safe ILIKE pattern
 */
const buildIlikePattern = (searchTerm) =>
  `%${escapeRegex(String(searchTerm).trim())}%`;

/**
 * Validate date range
 */
const validateDateRange = (startDate, endDate, maxDays = 365) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError("Invalid date format", 400);
  }

  if (start > end) {
    throw new AppError("Start date must be before end date", 400);
  }

  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > maxDays) {
    throw new AppError(`Date range cannot exceed ${maxDays} days`, 400);
  }

  if (end > now) {
    throw new AppError("End date cannot be in the future", 400);
  }

  return { start, end };
};

/* ============================================================================
   ANALYTICS
============================================================================ */

// Aggregate in PostgreSQL: PostgREST row caps must never truncate totals.
const analytics = kind => asyncHandler(async (req,res) => {
  ensureAdmin(req);
  const days = req.query.days === undefined ? 30 : Number(req.query.days);
  const period = kind === 'sales' ? (req.query.period || 'daily') : 'daily';
  if (!Number.isInteger(days) || days < 1 || days > 365 || !['daily','weekly','monthly'].includes(period)) throw new AppError('Invalid analytics range',400);
  const {data,error} = await supabase.rpc('admin_analytics',{p_kind:kind,p_days:days,p_period:period});
  if (error || !data) {
    logger.error('Database analytics unavailable',{kind,code:error?.code});
    throw new AppError('Analytics are unavailable. Verify the analytics migration is deployed.',503);
  }
  res.json({success:true,data});
});
export const getSalesAnalytics = analytics('sales');
export const getProductStats = analytics('products');
export const getUserAnalytics = analytics('users');
export const getOrderAnalytics = analytics('orders');
export const getDashboardOverview = analytics('overview');
export const getInventoryAnalytics = analytics('inventory');

/* ============================================================================
   USER MANAGEMENT
============================================================================ */

/**
 * @desc    Create user (admin)
 * @route   POST /api/admin/users
 * @access  Private/Admin
 */
export const createUser = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Name, email and password are required", 400);
  }

  const existing = await findUserByEmail(email, {}, supabase);
  if (existing) {
    throw new AppError("User with this email already exists", 400);
  }

  // NOTE: In your Supabase setup, make sure password is ALREADY hashed
  // before calling this route or implement hashing here.
  const user = await createUserRepo({
    name,
    email,
    password,
    role: role && ["user", "admin"].includes(role) ? role : "user",
  }, supabase);

  logger.info("Admin created user", {
    adminId: req.user?.id,
    userId: user.id,
  });

  res.status(201).json({
    success: true,
    data: publicUser(user),
  });
});

/**
 * @desc    Get all users with filters & pagination
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
export const getAllUsers = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  logger.info("Admin fetch users", {
    route: req.originalUrl,
    method: req.method,
    adminId: req.user?.id,
    query: req.query,
  });

  const { page, limit, skip } = validatePagination(req.query);

  const {
    search,
    role,
    isActive,
    sortBy = "created_at",
    sortOrder = "desc",
  } = req.query;

  let query = supabase.from("users").select("*", {
    count: "exact",
  });

  if (search) {
    const pattern = buildIlikePattern(search);
    const quotedPattern = quotePostgrestFilterValue(pattern);
    query = query.or(`name.ilike.${quotedPattern},email.ilike.${quotedPattern}`);
  }

  if (role && ["user", "admin"].includes(role)) {
    query = query.eq("role", role);
  }

  if (typeof isActive === "string") {
    if (isActive === "true") {
      query = query.eq("active", true);
    } else if (isActive === "false") {
      query = query.eq("active", false);
    }
  }

  const validSortFields = ["name", "email", "created_at", "updated_at"];
  const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";
  const ascending = sortOrder === "asc";

  query = query.order(sortField, { ascending }).range(skip, skip + limit - 1);

  const { data: users, error, count } = await query;

  if (error) {
    logger.error("Admin getAllUsers query failed", {
      error: error.message,
    });
    throw new AppError("Failed to fetch users", 500);
  }

  res.json({
    success: true,
    count: count ?? users.length,
    page,
    pages: Math.ceil((count ?? users.length) / limit),
    data: users.map(publicUser),
    filters: { search, role, isActive, sortBy, sortOrder },
  });

  logger.info("Admin fetched users", {
    count,
    page,
    limit,
    filters: req.query,
  });
});

/**
 * @desc    Get single user
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
export const getUserById = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const userId = req.params.id;
  if (!isValidUUID(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  const user = await findUserById(userId, {}, supabase);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const [{ data: addressRows }, { data: paymentRows }] = await Promise.all([
    supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false }),
    supabase
      .from("user_payment_methods")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false }),
  ]);

  const addresses = (addressRows || []).map((row) => {
    const parts = row.address?.split(", ") || [row.address || ""];
    return {
      id: row.id,
      userId: row.user_id,
      label: row.label,
      fullName: row.full_name,
      line1: parts[0] || "",
      line2: parts[1] || "",
      address: row.address,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      country: row.country,
      phoneNumber: row.phone_number,
      isDefault: row.is_default,
    };
  });

  const paymentMethods = (paymentRows || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    cardHolderName: row.card_holder_name,
    cardNumber: String(row.card_number || "").replace(/\D/g, "").slice(-4),
    expiryMonth: row.expiry_month,
    expiryYear: row.expiry_year,
    billingAddress: row.billing_address || {
      address: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
    isDefault: row.is_default,
  }));

  res.json({
    success: true,
    data: {
      ...publicUser(user),
      addresses,
      paymentMethods,
    },
  });
});

/**
 * @desc    Update user
 * @route   PUT /api/admin/users/:id
 * @access  Private/Admin
 */
export const updateUser = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const userId = req.params.id;
  if (!isValidUUID(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  logger.info("Admin update user", {
    adminId: req.user?.id,
    userId,
    bodyKeys: Object.keys(req.body || {}),
  });

  const allowedFields = ["name", "email", "role", "active"];
  const updates = {};

  for (const field of allowedFields) {
    if (field in req.body) {
      if (field === "role") {
        const roleValue = req.body.role;
        if (["user", "admin"].includes(roleValue)) {
          updates.role = roleValue;
        } else {
          throw new AppError("Invalid role value", 400);
        }
      } else if (field === "active") {
        updates.active = Boolean(req.body.active);
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("No valid fields provided to update", 400);
  }

  const updatedUser = await updateUserRepo(userId, updates, supabase);

  logger.info("Admin updated user", {
    adminId: req.user?.id,
    userId,
  });

  res.json({ success: true, data: publicUser(updatedUser) });
});

/**
 * @desc    Delete user
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
export const deleteUser = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const userId = req.params.id;
  if (!isValidUUID(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  logger.info("Admin delete user", {
    adminId: req.user?.id,
    userId,
  });

  const { error } = await supabase.from("users").delete().eq("id", userId);

  if (error) {
    logger.error("Admin delete user failed", {
      error: error.message,
    });
    throw new AppError("Failed to delete user", 500);
  }

  res.status(204).json({ success: true, data: null });
});

/* ============================================================================
   PRODUCT MANAGEMENT
============================================================================ */

/**
 * @desc    Get all products (admin) with filters
 * @route   GET /api/admin/products
 * @access  Private/Admin
 */
export const getAllProducts = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  logger.info("Admin fetch products", {
    route: req.originalUrl,
    method: req.method,
    adminId: req.user?.id,
    query: req.query,
  });

  const { page, limit, skip } = validatePagination(req.query);

  const {
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    minStock,
    maxStock,
    availability,
    isActive,
    isFeatured,
    createdFrom,
    createdTo,
    sortBy = "created_at",
    sortOrder = "desc",
  } = req.query;

  let query = supabase.from("products").select("*", { count: "exact" });

  // SEARCH
  if (search) {
    const pattern = buildIlikePattern(search);
    query = query.or(
      `name.ilike.${quotePostgrestFilterValue(pattern)},brand.ilike.${quotePostgrestFilterValue(pattern)},category.ilike.${quotePostgrestFilterValue(pattern)},description.ilike.${quotePostgrestFilterValue(pattern)}`
    );
  }

  // MULTI-SELECT CATEGORY
  if (category) {
    query = query.in("category", category.split(","));
  }

  // MULTI-SELECT BRAND
  if (brand) {
    query = query.in("brand", brand.split(","));
  }

  // AVAILABILITY (text)
  if (availability) {
    query = query.eq("availability", availability);
  }

  // PRICE RANGE
  if (minPrice) query = query.gte("final_price", Number(minPrice));
  if (maxPrice) query = query.lte("final_price", Number(maxPrice));

  // STOCK RANGE
  if (minStock) query = query.gte("stock", Number(minStock));
  if (maxStock) query = query.lte("stock", Number(maxStock));

  // BOOLEAN FILTERS
  if (typeof isActive === "string") {
    query = query.eq("is_active", isActive === "true");
  }

  if (typeof isFeatured === "string") {
    query = query.eq("is_featured", isFeatured === "true");
  }

  // DATE RANGE
  if (createdFrom && createdTo) {
    validateDateRange(createdFrom, createdTo);
  }

  if (createdFrom) {
    query = query.gte("created_at", new Date(createdFrom).toISOString());
  }
  if (createdTo) {
    query = query.lte("created_at", new Date(createdTo).toISOString());
  }

  // SORTING
  const validSortFields = [
    "name",
    "brand",
    "category",
    "final_price",
    "original_price",
    "discount_percentage",
    "availability",
    "stock",
    "sales_count",
    "created_at",
    "updated_at",
  ];

  const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";

  query = query
    .order(sortField, { ascending: sortOrder === "asc" })
    .range(skip, skip + limit - 1);

  const { data: products, error, count } = await query;

  if (error) {
    logger.error("Admin getAllProducts query failed", {
      error: error.message,
    });
    throw new AppError("Failed to fetch products", 500);
  }

  res.json({
    success: true,
    count: count ?? products.length,
    page,
    pages: Math.ceil((count ?? products.length) / limit),
    filters: req.query,
    data: products,
  });

  logger.info("Admin fetched products", {
    count,
    page,
    limit,
    filters: req.query,
  });
});

/**
 * @desc    Create new product (admin) with Cloudinary upload support
 * @route   POST /api/admin/products
 * @access  Private/Admin
 */
export const createProduct = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  logger.info("Admin create product request", {
    adminId: req.user?.id,
    bodyKeys: Object.keys(req.body || {}),
    filesCount: (req.files && req.files.length) || 0,
  });

  const {
    name,
    category,
    brand,
    originalPrice,
    discountPercentage = 0,
    stock = 0,
    description,
    specifications,
    features,
    warranty,
    weight,
    dimensions,
    sku,
    isActive = true,
    isFeatured = false,
  } = req.body;

  if (!name || !category || !brand || !originalPrice || !sku) {
    throw new AppError(
      "name, category, brand, originalPrice and sku are required",
      400
    );
  }

  let suppliedImages = req.body.images;
  if (typeof suppliedImages === "string") {
    try { suppliedImages = JSON.parse(suppliedImages); } catch { throw new AppError("Invalid image list", 400); }
  }
  if (suppliedImages !== undefined && !Array.isArray(suppliedImages)) throw new AppError("Invalid image list", 400);
  const images = suppliedImages ?? [];
  if (images.some(image => typeof image !== "string" || !/^https:\/\//i.test(image))) throw new AppError("Images must use HTTPS URLs", 400);
  if (!Number.isInteger(Number(stock)) || Number(stock) < 0) throw new AppError("Stock must be a non-negative integer", 400);

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "products",
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });

      images.push(uploadResult.secure_url);
    }
  }

  // Helper function to safely parse JSON
  // Helper function to safely parse JSON
  const safeJSONParse = (str, defaultValue = null) => {
    if (str === null || str === undefined) return defaultValue;
    if (typeof str === "object") return str; // Already parsed
    if (typeof str !== "string") return defaultValue; // Should be string or object
    if (str.trim() === "") return defaultValue;
    try {
      return JSON.parse(str);
    } catch (e) {
      throw new AppError("Invalid JSON in product details", 400);
    }
  };

  const payload = {
    name,
    category,
    brand,
    originalPrice: Number(originalPrice),
    discountPercentage: Number(discountPercentage) || 0,
    stock: Number(stock) || 0,
    description,
    specifications: safeJSONParse(specifications, null),
    features: safeJSONParse(features, []),
    warranty,
    weight: weight ? Number(weight) : null,
    dimensions: safeJSONParse(dimensions, null),
    sku,
    isActive: isActive === true || isActive === "true",
    isFeatured: isFeatured === true || isFeatured === "true",
    images,
  };

  const product = await createProductRepo(payload, supabase);

  logger.info("Admin created product", {
    adminId: req.user?.id,
    productId: product.id,
  });

  res.status(201).json({
    success: true,
    data: product,
  });
});

/**
 * @desc    Update product (admin)
 * @route   PUT /api/admin/products/:id
 * @access  Private/Admin
 */
export const updateProduct = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const productId = req.params.id;
  if (!isValidUUID(productId)) {
    throw new AppError("Invalid product ID", 400);
  }

  logger.info("Admin update product", {
    adminId: req.user?.id,
    productId,
    bodyKeys: Object.keys(req.body || {}),
    filesCount: (req.files && req.files.length) || 0,
  });

  const existing = await getProductById(productId, supabase);
  if (!existing) {
    throw new AppError("Product not found", 404);
  }

  const updates = { ...req.body };

  // Normalise boolean/numeric fields
  if ("originalPrice" in updates) {
    updates.originalPrice = Number(updates.originalPrice);
  }
  if ("discountPercentage" in updates) {
    updates.discountPercentage = Number(updates.discountPercentage);
  }
  if ("stock" in updates) {
    updates.stock = Number(updates.stock);
    if (!Number.isInteger(updates.stock) || updates.stock < 0) throw new AppError("Stock must be a non-negative integer", 400);
  }
  if ("isActive" in updates) {
    updates.isActive = updates.isActive === "true" || updates.isActive === true;
  }
  if ("isFeatured" in updates) {
    updates.isFeatured =
      updates.isFeatured === "true" || updates.isFeatured === true;
  }
  if (
    "specifications" in updates &&
    typeof updates.specifications === "string"
  ) {
    try {
      updates.specifications = JSON.parse(updates.specifications);
    } catch {
      throw new AppError("Invalid JSON for specifications", 400);
    }
  }
  if ("features" in updates && typeof updates.features === "string") {
    try {
      updates.features = JSON.parse(updates.features);
    } catch {
      throw new AppError("Invalid JSON for features", 400);
    }
  }
  if ("dimensions" in updates && typeof updates.dimensions === "string") {
    try {
      updates.dimensions = JSON.parse(updates.dimensions);
    } catch {
      throw new AppError("Invalid JSON for dimensions", 400);
    }
  }

  if (typeof updates.images === "string") {
    try { updates.images = JSON.parse(updates.images); } catch { throw new AppError("Invalid image list", 400); }
  }
  if (updates.images !== undefined && (!Array.isArray(updates.images) || updates.images.some(image => typeof image !== "string" || !/^https:\/\//i.test(image)))) throw new AppError("Images must use HTTPS URLs", 400);

  // Handle optional new images
  if (req.files && req.files.length > 0) {
    const newImages = [];
    for (const file of req.files) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "products",
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });

      newImages.push(uploadResult.secure_url);
    }

    updates.images = [...(updates.images ?? existing.images ?? []), ...newImages];
  }

  const updatedProduct = await updateProductRepo(productId, updates, supabase);

  logger.info("Admin updated product", {
    adminId: req.user?.id,
    productId,
  });

  res.json({ success: true, data: updatedProduct });
});

/**
 * @desc    Delete product (admin)
 * @route   DELETE /api/admin/products/:id
 * @access  Private/Admin
 */
export const deleteProduct = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const productId = req.params.id;
  if (!isValidUUID(productId)) {
    throw new AppError("Invalid product ID", 400);
  }

  logger.info("Admin delete product", {
    adminId: req.user?.id,
    productId,
  });

  await deleteProductRepo(productId, supabase);

  res.status(204).json({ success: true, data: null });
});

/**
 * @desc    Toggle product active status
 * @route   PATCH /api/admin/products/:id/toggle-active
 * @access  Private/Admin
 */
export const toggleProductActive = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const productId = req.params.id;
  if (!isValidUUID(productId)) {
    throw new AppError("Invalid product ID", 400);
  }

  const existing = await getProductById(productId, supabase);
  if (!existing) {
    throw new AppError("Product not found", 404);
  }

  const updated = await updateProductRepo(productId, {
    isActive: !existing.isActive,
  }, supabase);

  res.json({ success: true, data: updated });
});

/**
 * @desc    Toggle product featured status
 * @route   PATCH /api/admin/products/:id/feature
 * @access  Private/Admin
 */
export const toggleProductFeature = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const productId = req.params.id;
  if (!isValidUUID(productId)) {
    throw new AppError("Invalid product ID", 400);
  }

  const existing = await getProductById(productId, supabase);
  if (!existing) {
    throw new AppError("Product not found", 404);
  }

  const updated = await updateProductRepo(productId, {
    isFeatured: !existing.isFeatured,
  }, supabase);

  res.json({ success: true, data: updated });
});

/**
 * @desc    Update product stock
 * @route   PATCH /api/admin/products/:id/stock
 * @access  Private/Admin
 */
export const updateProductStock = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const productId = req.params.id;
  if (!isValidUUID(productId)) {
    throw new AppError("Invalid product ID", 400);
  }

  const { stock } = req.body;
  if (stock === undefined || !Number.isInteger(Number(stock))) {
    throw new AppError("Valid stock number is required", 400);
  }

  const updated = await updateProductRepo(productId, {
    stock: Number(stock),
  }, supabase);

  res.json({ success: true, data: updated });
});

/**
 * @desc    Get product reviews
 * @route   GET /api/admin/products/:id/reviews
 * @access  Private/Admin
 */
export const getProductReviews = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const productId = req.params.id;
  if (!isValidUUID(productId)) {
    throw new AppError("Invalid product ID", 400);
  }

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Admin getProductReviews query failed", {
      error: error.message,
    });
    throw new AppError("Failed to fetch reviews", 500);
  }

  res.json({ success: true, data: reviews });
});

/**
 * @desc    Get all reviews (admin)
 * @route   GET /api/admin/reviews
 * @access  Private/Admin
 */
export const getAllReviews = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const { page, limit, skip } = validatePagination(req.query);

  const {
    search,
    productId,
    userId,
    rating,
    minRating,
    maxRating,
    isActive,
    createdFrom,
    createdTo,
    sortBy = "created_at",
    sortOrder = "desc",
  } = req.query;

  let query = supabase
    .from("reviews")
    .select("*, user:users(name,email), product:products(name)", {
      count: "exact",
    });

  // SEARCH in title/comment
  if (search) {
    const pattern = buildIlikePattern(search);
    const quotedPattern = quotePostgrestFilterValue(pattern);
    query = query.or(`title.ilike.${quotedPattern},comment.ilike.${quotedPattern}`);
  }

  // PRODUCT
  if (productId) {
    if (!isValidUUID(productId)) throw new AppError("Invalid product ID", 400);
    query = query.eq("product_id", productId);
  }

  // USER
  if (userId) {
    if (!isValidUUID(userId)) throw new AppError("Invalid user ID", 400);
    query = query.eq("user_id", userId);
  }

  if (typeof req.query.reported === 'string') query = query.eq('reported', req.query.reported === 'true');

  // EXACT RATING
  if (rating) query = query.eq("rating", Number(rating));

  // RANGE RATING
  if (minRating) query = query.gte("rating", Number(minRating));
  if (maxRating) query = query.lte("rating", Number(maxRating));

  // ACTIVE / INACTIVE
  if (typeof isActive === "string") {
    query = query.eq("is_active", isActive === "true");
  }

  // DATE RANGE
  if (createdFrom && createdTo) {
    validateDateRange(createdFrom, createdTo);
  }
  if (createdFrom)
    query = query.gte("created_at", new Date(createdFrom).toISOString());
  if (createdTo)
    query = query.lte("created_at", new Date(createdTo).toISOString());

  // SORTING
  const validSortFields = ["created_at", "rating", "is_active"];
  const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";

  query = query
    .order(sortField, { ascending: sortOrder === "asc" })
    .range(skip, skip + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new AppError("Failed to fetch reviews", 500);

  res.json({
    success: true,
    count,
    page,
    pages: Math.ceil(count / limit),
    data,
  });
});

/**
 * @desc    Moderate review
 * @route   PATCH /api/admin/reviews/:id/moderate
 * @access  Private/Admin
 */
export const moderateReview = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const reviewId = req.params.id;
  if (!isValidUUID(reviewId)) {
    throw new AppError("Invalid review ID", 400);
  }

  const { isActive, reportReason, action } = req.body;

  const updates = {};

  // Handle action-based moderation (approve/reject)
  if (action === "approve") {
    updates.is_active = true;
    updates.reported = false;
    updates.report_reason = null;
  } else if (action === "reject") {
    updates.is_active = false;
  }

  // Handle direct field updates (legacy/flexible support)
  if (isActive !== undefined) {
    updates.is_active = Boolean(isActive);
  }
  if (reportReason !== undefined) {
    updates.report_reason = reportReason;
    updates.reported = Boolean(reportReason);
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("No update fields provided", 400);
  }

  const { data: updated, error } = await supabase
    .from("reviews")
    .update(updates)
    .eq("id", reviewId)
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to moderate review", 500);
  }

  res.json({ success: true, data: updated });
});

/**
 * @desc    Delete product review (soft delete)
 * @route   DELETE /api/admin/reviews/:id
 * @access  Private/Admin
 */
export const deleteProductReview = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const reviewId = req.params.id;
  if (!isValidUUID(reviewId)) {
    throw new AppError("Invalid review ID", 400);
  }

  const deleted = await softDeleteReview(reviewId, supabase);

  logger.info("Admin deleted review", {
    adminId: req.user?.id,
    reviewId,
  });

  res.json({ success: true, data: deleted });
});

/* ============================================================================
   ORDER MANAGEMENT
============================================================================ */

/**
 * @desc    Get all orders (with advanced filters)
 * @route   GET /api/admin/orders
 * @access  Private/Admin
 */
export const getOrders = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const { page, limit, skip } = validatePagination(req.query);

  const {
    status,
    isPaid,
    minTotal,
    maxTotal,
    createdFrom,
    createdTo,
    hasItems,
    sortBy = "created_at",
    sortOrder = "desc",
  } = req.query;

  logger.info("Admin fetch orders", {
    adminId: req.user?.id,
    query: req.query,
  });

  let query = supabase
    .from("orders")
    .select("*, items:order_items (*)", { count: "exact" });

  // STATUS
  if (req.query.search) {
    const search = String(req.query.search).trim();
    if (!isValidUUID(search)) throw new AppError('Enter a complete order or user ID to search.', 400);
    query = query.or(`id.eq.${search},user_id.eq.${search}`);
  }

  if (status) query = query.eq("status", status);

  // PAYMENT STATUS
  if (typeof isPaid === "string") {
    query = query.eq("is_paid", isPaid === "true");
  }

  // TOTAL PRICE RANGE
  if (minTotal) query = query.gte("total_price", Number(minTotal));
  if (maxTotal) query = query.lte("total_price", Number(maxTotal));

  // DATE RANGE
  if (createdFrom && createdTo) {
    validateDateRange(createdFrom, createdTo);
  }
  if (createdFrom)
    query = query.gte("created_at", new Date(createdFrom).toISOString());
  if (createdTo)
    query = query.lte("created_at", new Date(createdTo).toISOString());

  // ORDERS must contain items
  if (hasItems === "true") query = query.not("items", "is", null);

  const validSort = ["created_at", "total_price", "status", "updated_at"];
  const sortField = validSort.includes(sortBy) ? sortBy : "created_at";

  query = query
    .order(sortField, { ascending: sortOrder === "asc" })
    .range(skip, skip + limit - 1);

  const { data: orders, error, count } = await query;

  if (error) {
    logger.error("Admin getOrders query failed", {
      error: error.message,
    });
    throw new AppError("Failed to fetch orders", 500);
  }

  res.json({
    success: true,
    page,
    pages: Math.ceil((count ?? orders.length) / limit),
    count,
    data: orders,
  });
});

/**
 * @desc    Mark order as delivered
 * @route   PUT /api/admin/orders/:id/deliver
 * @access  Private/Admin
 */
export const updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const orderId = req.params.id;
  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  const order = await getOrderById(orderId, supabase);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (!order.is_paid || order.status !== "shipped") {
    throw new AppError("Only a shipped, paid order can be delivered", 400);
  }

  const nowIso = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      is_delivered: true,
      delivered_at: nowIso,
      status: "delivered",
      updated_at: nowIso,
    })
    .eq("id", orderId).eq("status",order.status).eq("updated_at",order.updated_at)
    .select()
    .single();

  if (error) {
    logger.error("Admin updateOrderToDelivered failed", {
      error: error.message,
    });
    throw new AppError("Failed to update order", 500);
  }

  res.json({ success: true, data: updated });
});

/**
 * @desc    Mark order as paid (admin override)
 * @route   PUT /api/admin/orders/:id/pay
 * @access  Private/Admin
 */
export const markOrderAsPaid = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const orderId = req.params.id;
  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  const order = await getOrderById(orderId, supabase);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.is_paid) {
    throw new AppError("Order is already paid", 400);
  }

  if (order.payment_method !== "cod" || ["cancelled", "refunded", "returned"].includes(order.status)) {
    throw new AppError("Only an eligible cash-on-delivery order can be manually marked paid", 409);
  }

  const paymentResult = {
    id: `ADMIN_${orderId}`,
    status: "succeeded",
    update_time: new Date().toISOString(),
    email_address: null,
    payment_method: "admin_manual",
  };

  const updated = await markOrderPaidRepo(orderId, paymentResult, supabase, order);

  logger.info("Admin marked order as paid", {
    adminId: req.user?.id,
    orderId,
  });

  res.json({ success: true, data: updated });
});

/**
 * @desc    Update order status
 * @route   PUT /api/admin/orders/:id/status
 * @access  Private/Admin
 */
export const updateOrderStatus = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const orderId = req.params.id;
  const { status, notes } = req.body;

  if (["paid", "refunded", "cancelled", "returned"].includes(status)) {
    throw new AppError("Payment, cancellation and return states must be confirmed through their dedicated workflows", 409);
  }

  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  const allowedStatuses = [
    "pending",
    "processing",
    "paid",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
    "returned",
  ];

  if (!status || !allowedStatuses.includes(status)) {
    throw new AppError("Invalid status value", 400);
  }

  const order = await getOrderById(orderId, supabase);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  const transitions={pending:['processing'],paid:['processing'],processing:['shipped']};
  if (!transitions[order.status]?.includes(status) || (order.payment_method !== 'cod' && !order.is_paid)) throw new AppError('Order is not eligible for this fulfillment transition',409);
  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      status,
      notes: notes ?? order.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId).eq("status",order.status).eq("updated_at",order.updated_at)
    .select()
    .single();

  if (error) {
    logger.error("Admin updateOrderStatus failed", {
      error: error.message,
    });
    throw new AppError("Failed to update order status", 500);
  }

  logger.info("Admin updated order status", {
    adminId: req.user?.id,
    orderId,
    status,
  });

  res.json({ success: true, data: updated });
});

/**
 * @desc    Process refund (simple admin-level flag)
 * @route   POST /api/admin/orders/:id/refund
 * @access  Private/Admin
 */
export const processRefund = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);
  throw new AppError('Refund processing is unavailable. No money has been refunded. Contact the payment administrator.', 503);
});

/**
 * @desc    Process return
 * @route   POST /api/admin/orders/:id/return
 * @access  Private/Admin
 */
export const processReturn = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const orderId = req.params.id;
  const { returnStatus, notes } = req.body;

  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  if (returnStatus === 'completed') throw new AppError('Return completion requires the inventory and refund reconciliation workflow, which is not yet available.',503);
  const allowedReturnStatuses = [
    "none",
    "requested",
    "approved",
    "rejected",
    "completed",
  ];

  if (!returnStatus || !allowedReturnStatuses.includes(returnStatus)) {
    throw new AppError("Invalid return status", 400);
  }

  const order = await getOrderById(orderId, supabase);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.return_status !== 'requested' || !['approved','rejected'].includes(returnStatus)) throw new AppError('Return is not eligible for this transition',409);
  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      return_status: returnStatus,
      notes: notes ?? order.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId).eq("return_status",order.return_status).eq("updated_at",order.updated_at)
    .select()
    .single();

  if (error) {
    logger.error("Admin processReturn failed", {
      error: error.message,
    });
    throw new AppError("Failed to process return", 500);
  }

  logger.info("Admin processed return", {
    adminId: req.user?.id,
    orderId,
    returnStatus,
  });

  res.json({ success: true, data: updated });
});

/**
 * @desc    Approve return request
 * @route   PATCH /api/admin/orders/:id/approve-return
 * @access  Private/Admin
 */
export const approveReturn = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const orderId = req.params.id;
  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  const order = await getOrderById(orderId, supabase);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.return_status !== "requested") {
    throw new AppError("Order return is not in requested status", 400);
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      return_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId).eq("return_status","requested").eq("updated_at",order.updated_at)
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to approve return", 500);
  }

  res.json({ success: true, data: updated });
});

/* ============================================================================
   COUPON MANAGEMENT
============================================================================ */

/**
 * @desc    Create coupon
 * @route   POST /api/admin/coupons
 * @access  Private/Admin
 */
export const createCoupon = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const {
    code,
    discountType, // 'fixed' | 'percent'
    discountValue,
    minPurchase,
    maxDiscount,
    validFrom,
    validTo,
    isActive = true,
    usageLimit,
    perUserLimit,
    applicableProducts,
    excludedProducts,
    description,
  } = req.body;

  if (!code || !discountType || discountValue == null) {
    throw new AppError(
      "code, discountType and discountValue are required",
      400
    );
  }

  // Align with schema enum: coupon_discount_type_enum ('fixed', 'percent')
  if (!["fixed", "percent"].includes(discountType)) {
    throw new AppError("Invalid discountType. Use 'fixed' or 'percent'.", 400);
  }

  const insertData = {
    code: String(code).trim().toUpperCase(),
    discount_type: discountType, // 'fixed' | 'percent'
    discount_value: Number(discountValue),
    min_purchase: minPurchase != null ? Number(minPurchase) : 0,
    max_discount: maxDiscount != null ? Number(maxDiscount) : null,
    valid_from: validFrom ? new Date(validFrom).toISOString() : null,
    valid_to: validTo ? new Date(validTo).toISOString() : null,
    is_active: Boolean(isActive),
    usage_limit: usageLimit != null ? Number(usageLimit) : null,
    times_used: 0,
    per_user_limit: perUserLimit != null ? Number(perUserLimit) : null,
    applicable_products: Array.isArray(applicableProducts)
      ? applicableProducts
      : null,
    excluded_products: Array.isArray(excludedProducts)
      ? excludedProducts
      : null,
    description: description || null,
  };

  const { data, error } = await supabase
    .from("coupons")
    .insert([insertData])
    .select()
    .single();

  if (error) {
    logger.error("Admin createCoupon failed", {
      error: error.message,
    });
    throw new AppError("Failed to create coupon", 500);
  }

  res.status(201).json({ success: true, data });
});

/**
 * @desc    Get all coupons
 * @route   GET /api/admin/coupons
 * @access  Private/Admin
 */
export const getCoupons = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const { page, limit, skip } = validatePagination(req.query);

  const {
    search,
    type, // 'fixed' | 'percent'
    minDiscount,
    maxDiscount,
    minCart, // maps to min_purchase
    maxCart, // maps to min_purchase
    active, // boolean string
    valid, // 'true' for currently valid coupons
    createdFrom,
    createdTo,
    expiresFrom, // maps to valid_to
    expiresTo, // maps to valid_to
    sortBy = "created_at",
    sortOrder = "desc",
  } = req.query;

  let query = supabase.from("coupons").select("*", { count: "exact" });

  // SEARCH BY CODE
  if (search) {
    const pattern = buildIlikePattern(search);
    query = query.ilike("code", pattern);
  }

  // TYPE = fixed or percent (schema-aligned)
  if (type) query = query.eq("discount_type", type);

  // DISCOUNT RANGE
  if (minDiscount) query = query.gte("discount_value", Number(minDiscount));
  if (maxDiscount) query = query.lte("discount_value", Number(maxDiscount));

  // MIN CART RANGE (maps to min_purchase)
  if (minCart) query = query.gte("min_purchase", Number(minCart));
  if (maxCart) query = query.lte("min_purchase", Number(maxCart));

  // ACTIVE only (maps to is_active)
  if (typeof active === "string") {
    query = query.eq("is_active", active === "true");
  }

  // VALID (not expired & active) – basic DB-side filter
  if (valid === "true") {
    const nowIso = new Date().toISOString();
    query = query
      .eq("is_active", true)
      // valid_to null = no expiry, OR valid_to in future
      .or(`valid_to.is.null,valid_to.gt.${nowIso}`);
  }

  // CREATION DATE RANGE
  if (createdFrom && createdTo) {
    validateDateRange(createdFrom, createdTo);
  }
  if (createdFrom)
    query = query.gte("created_at", new Date(createdFrom).toISOString());
  if (createdTo)
    query = query.lte("created_at", new Date(createdTo).toISOString());

  // EXPIRY DATE RANGE (maps to valid_to)
  if (expiresFrom)
    query = query.gte("valid_to", new Date(expiresFrom).toISOString());
  if (expiresTo)
    query = query.lte("valid_to", new Date(expiresTo).toISOString());

  // SORTING (aligned with schema)
  const validSortFields = [
    "created_at",
    "valid_to",
    "discount_value",
    "min_purchase",
    "is_active",
    "usage_limit",
    "times_used",
  ];

  const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";

  query = query
    .order(sortField, { ascending: sortOrder === "asc" })
    .range(skip, skip + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new AppError("Failed to fetch coupons", 500);

  res.json({
    success: true,
    count,
    page,
    pages: Math.ceil(count / limit),
    data,
  });
});

/**
 * @desc    Get coupon by ID
 * @route   GET /api/admin/coupons/:id
 * @access  Private/Admin
 */
export const getCoupon = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const couponId = req.params.id;
  if (!isValidUUID(couponId)) {
    throw new AppError("Invalid coupon ID", 400);
  }

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("id", couponId)
    .maybeSingle();

  if (error) {
    logger.error("Admin getCoupon query failed", {
      error: error.message,
    });
    throw new AppError("Failed to fetch coupon", 500);
  }

  if (!data) {
    throw new AppError("Coupon not found", 404);
  }

  res.json({ success: true, data });
});

/**
 * @desc    Update coupon
 * @route   PUT /api/admin/coupons/:id
 * @access  Private/Admin
 */
export const updateCoupon = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const couponId = req.params.id;
  if (!isValidUUID(couponId)) {
    throw new AppError("Invalid coupon ID", 400);
  }

  const updates = {};
  const fields = [
    "code",
    "discountType",
    "discountValue",
    "minPurchase",
    "maxDiscount",
    "validFrom",
    "validTo",
    "isActive",
    "usageLimit",
    "perUserLimit",
    "applicableProducts",
    "excludedProducts",
    "description",
  ];

  for (const field of fields) {
    if (field in req.body) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("No fields provided to update", 400);
  }

  const dbUpdates = {};

  if (updates.code) {
    dbUpdates.code = String(updates.code).trim().toUpperCase();
  }
  if (updates.discountType) {
    if (!["fixed", "percent"].includes(updates.discountType)) {
      throw new AppError("Invalid discountType", 400);
    }
    dbUpdates.discount_type = updates.discountType;
  }
  if (updates.discountValue != null) {
    dbUpdates.discount_value = Number(updates.discountValue);
  }
  if (updates.minPurchase != null) {
    dbUpdates.min_purchase = Number(updates.minPurchase);
  }
  if (updates.maxDiscount != null) {
    dbUpdates.max_discount = Number(updates.maxDiscount);
  }
  if (updates.validFrom != null) {
    dbUpdates.valid_from = updates.validFrom
      ? new Date(updates.validFrom).toISOString()
      : null;
  }
  if (updates.validTo != null) {
    dbUpdates.valid_to = updates.validTo
      ? new Date(updates.validTo).toISOString()
      : null;
  }
  if (updates.isActive != null) {
    dbUpdates.is_active = Boolean(updates.isActive);
  }
  if (updates.usageLimit != null) {
    dbUpdates.usage_limit = Number(updates.usageLimit);
  }
  if (updates.perUserLimit != null) {
    dbUpdates.per_user_limit = Number(updates.perUserLimit);
  }
  if (updates.applicableProducts != null) {
    dbUpdates.applicable_products = Array.isArray(updates.applicableProducts)
      ? updates.applicableProducts
      : null;
  }
  if (updates.excludedProducts != null) {
    dbUpdates.excluded_products = Array.isArray(updates.excludedProducts)
      ? updates.excludedProducts
      : null;
  }
  if (updates.description != null) {
    dbUpdates.description = updates.description;
  }

  const { data, error } = await supabase
    .from("coupons")
    .update(dbUpdates)
    .eq("id", couponId)
    .select()
    .single();

  if (error) {
    logger.error("Admin updateCoupon failed", {
      error: error.message,
    });
    throw new AppError("Failed to update coupon", 500);
  }

  res.json({ success: true, data });
});

/**
 * @desc    Delete coupon
 * @route   DELETE /api/admin/coupons/:id
 * @access  Private/Admin
 */
export const deleteCoupon = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const couponId = req.params.id;
  if (!isValidUUID(couponId)) {
    throw new AppError("Invalid coupon ID", 400);
  }

  const { error } = await supabase.from("coupons").delete().eq("id", couponId);

  if (error) {
    logger.error("Admin deleteCoupon failed", {
      error: error.message,
    });
    throw new AppError("Failed to delete coupon", 500);
  }

  res.status(204).json({ success: true, data: null });
});

/**
 * @desc    Toggle coupon active status
 * @route   PATCH /api/admin/coupons/:id/toggle
 * @access  Private/Admin
 */
export const toggleCoupon = asyncHandler(async (req, res, next) => {
  ensureAdmin(req, next);

  const couponId = req.params.id;
  if (!isValidUUID(couponId)) {
    throw new AppError("Invalid coupon ID", 400);
  }

  const { data: coupon, error: fetchError } = await supabase
    .from("coupons")
    .select("is_active")
    .eq("id", couponId)
    .maybeSingle();

  if (fetchError || !coupon) {
    throw new AppError("Coupon not found", 404);
  }

  const { data: updated, error } = await supabase
    .from("coupons")
    .update({ is_active: !coupon.is_active })
    .eq("id", couponId)
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to toggle coupon", 500);
  }

  res.json({ success: true, data: updated });
});
