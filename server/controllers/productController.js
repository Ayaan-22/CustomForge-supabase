// File: server/controllers/productController.js
import asyncHandler from "express-async-handler";
import AppError from "../utils/appError.js";
import { logger } from "../middleware/logger.js";
import validator from "validator";
import { supabase } from "../config/db.js";

// Import lightweight utilities from Product model
import {
  recalcProductRatings,
} from "../models/Product.js";

/**
 * Validate UUID format (Supabase IDs)
 */
const isValidUUID = (value) => {
  return typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);
};

/**
 * Enhanced input sanitization utility
 */
const sanitizeInput = (input, options = {}) => {
  const { allowHTML = false, maxLength = 1000 } = options;

  if (typeof input === "string") {
    let sanitized = validator.trim(input);
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    return allowHTML ? sanitized : validator.escape(sanitized);
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item, options));
  }

  if (typeof input === "object" && input !== null) {
    const sanitized = {};
    Object.keys(input).forEach((key) => {
      sanitized[key] = sanitizeInput(input[key], options);
    });
    return sanitized;
  }

  return input;
};

/**
 * Query sanitization for filters
 * Only allow safe, whitelisted fields from query params
 */
const sanitizeQuery = (query) => {
  const allowedFilters = [
    "category",
    "brand",
    "availability",
    "minPrice",
    "maxPrice",
    "minRating",
    "maxRating",
  ];
  const sanitized = {};

  if (!query || typeof query !== "object") return sanitized;

  Object.keys(query).forEach((key) => {
    if (allowedFilters.includes(key)) {
      const value = sanitizeInput(query[key]);
      // Validate numeric fields
      if (["minPrice", "maxPrice", "minRating", "maxRating"].includes(key)) {
        const num = Number(value);
        if (!Number.isNaN(num)) {
          sanitized[key] = num;
        }
      } else {
        sanitized[key] = value;
      }
    }
  });

  return sanitized;
};

/**
 * Product category enum (from original Mongoose schema)
 */
const VALID_CATEGORIES = [
  "Prebuilt PCs",
  "CPU",
  "GPU",
  "Motherboard",
  "RAM",
  "Storage",
  "Power Supply",
  "Cooler",
  "Case",
  "OS",
  "Networking",
  "RGB",
  "CaptureCard",
  "Monitor",
  "Keyboard",
  "Mouse",
  "Mousepad",
  "Headset",
  "Speakers",
  "Controller",
  "ExternalStorage",
  "VR",
  "StreamingGear",
  "Microphone",
  "Webcam",
  "GamingChair",
  "GamingDesk",
  "SoundCard",
  "Cables",
  "GamingLaptop",
  "Games",
  "PCGames",
  "ConsoleGames",
  "VRGames",
];

/**
 * Map DB product (snake_case) to API product (camelCase)
 */
const mapProduct = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    specifications: row.specifications,
    originalPrice: row.original_price,
    discountPercentage: row.discount_percentage,
    finalPrice: row.final_price,
    stock: row.stock,
    availability: row.availability,
    images: row.images,
    description: row.description,
    ratings: row.ratings,
    features: row.features,
    warranty: row.warranty,
    weight: row.weight,
    dimensions: row.dimensions,
    sku: row.sku,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    salesCount: row.sales_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapProducts = (rows) => (Array.isArray(rows) ? rows.map(mapProduct) : []);

/**
 * Map DB review + user to API review shape
 */
const mapReviewWithUser = (review, userLookup) => {
  const user = (review.user_id && userLookup.get(review.user_id)) || undefined;

  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    createdAt: review.created_at,
    verifiedPurchase: review.verified_purchase,
    helpfulVotes: review.helpful_votes,
    media: review.media,
    user: user
      ? {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          verified: user.is_email_verified,
        }
      : null,
  };
};

// ============================================
// PUBLIC PRODUCT CONTROLLERS
// ============================================

/**
 * @desc Get all products with filtering, sorting, pagination
 * @route GET /api/products
 * @access Public
 */
export const getAllProducts = asyncHandler(async (req, res, next) => {
  const sanitizedQuery = sanitizeQuery(req.query);

  logger.info("Fetching products", {
    route: req.originalUrl,
    method: req.method,
    query: Object.keys(sanitizedQuery),
  });

  // Pagination
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Sorting
  const sortRaw = req.query.sort || "-created_at";
  let sortField = "created_at";
  let ascending = false;

  if (typeof sortRaw === "string" && sortRaw.length > 0) {
    ascending = !sortRaw.startsWith("-");
    const clean = sortRaw.replace(/^-/, "");
    if (clean === "finalPrice") sortField = "final_price";
    else if (clean === "name") sortField = "name";
    else if (clean === "createdAt") sortField = "created_at";
    else sortField = clean;
  }

  // Build base query
  let query = supabase
    .from("products")
    .select(
      "id, name, category, brand, final_price, images, ratings, stock, availability, is_active",
      { count: "exact" }
    )
    .eq("is_active", true);

  // Apply filters
  if (sanitizedQuery.category) {
    query = query.eq("category", sanitizedQuery.category);
  }
  if (sanitizedQuery.brand) {
    query = query.eq("brand", sanitizedQuery.brand);
  }
  if (sanitizedQuery.availability) {
    query = query.eq("availability", sanitizedQuery.availability);
  }
  if (sanitizedQuery.minPrice) {
    query = query.gte("final_price", sanitizedQuery.minPrice);
  }
  if (sanitizedQuery.maxPrice) {
    query = query.lte("final_price", sanitizedQuery.maxPrice);
  }

  const {
    data: rows,
    error,
    count,
  } = await query.order(sortField, { ascending }).range(from, to);

  if (error) {
    logger.error("Error fetching products", { error: error.message });
    return next(new AppError("Failed to fetch products", 500));
  }

  // Apply rating filters in JS
  let filtered = rows;
  if (sanitizedQuery.minRating || sanitizedQuery.maxRating) {
    const minR = sanitizedQuery.minRating || 0;
    const maxR = sanitizedQuery.maxRating || 5;

    filtered = rows.filter((p) => {
      const avg = p.ratings?.average ?? 0;
      return avg >= minR && avg <= maxR;
    });
  }

  const products = mapProducts(filtered);

  res.status(200).json({
    success: true,
    count: count ?? products.length,
    results: products.length,
    data: products,
  });

  logger.info("Fetched products successfully", {
    count: count ?? products.length,
    results: products.length,
  });
});

/**
 * @desc Get single product with reviews, game & PC details
 * @route GET /api/products/:id
 * @access Public
 */
export const getProduct = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;

  if (!isValidUUID(productId)) {
    logger.warn("Invalid product ID format", { id: productId });
    return next(new AppError("Invalid product ID format", 400));
  }

  try {
    // 1) Get product
    const { data: productRow, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("is_active", true)
      .single();

    if (productError && productError.code === "PGRST116") {
      logger.warn("Product not found", { id: productId });
      return next(new AppError("No product found with that ID", 404));
    }
    if (productError) throw productError;

    // 2) Get last 10 reviews
    const { data: reviewRows, error: reviewsError } = await supabase
      .from("reviews")
      .select(
        "id, user_id, rating, title, comment, created_at, verified_purchase, helpful_votes, media, is_active"
      )
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (reviewsError) throw reviewsError;

    // 3) Get all users for those reviews
    const userIds = [
      ...new Set(reviewRows.map((r) => r.user_id).filter(Boolean)),
    ];

    let userLookup = new Map();
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, name, avatar, is_email_verified")
        .in("id", userIds);

      if (usersError) throw usersError;
      userLookup = new Map(users.map((u) => [u.id, u]));
    }

    const mappedReviews = reviewRows.map((r) =>
      mapReviewWithUser(r, userLookup)
    );

    // 4) Game details (if any)
    const { data: gameRow, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();

    if (gameError) throw gameError;

    // 5) Prebuilt PC details (if any)
    const { data: pcRow, error: pcError } = await supabase
      .from("prebuilt_pcs")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();

    if (pcError) throw pcError;

    const product = mapProduct(productRow);

    res.status(200).json({
      success: true,
      data: {
        ...product,
        reviews: mappedReviews,
        gameDetails: gameRow || null,
        pcDetails: pcRow || null,
      },
    });

    logger.info("Fetched product successfully", { id: productId });
  } catch (error) {
    logger.error("Error fetching product", {
      error: error.message,
      id: productId,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
    return next(new AppError("Failed to fetch product", 500));
  }
});

/**
 * @desc Get top rated products
 * @route GET /api/products/top
 * @access Public
 */
export const getTopProducts = asyncHandler(async (req, res, next) => {
  const { data: rows, error } = await supabase
    .from("products")
    .select(
      "id, name, category, brand, final_price, images, ratings, stock, is_active"
    )
    .eq("is_active", true);

  if (error) {
    logger.error("Error fetching top products", { error: error.message });
    return next(new AppError("Failed to fetch top products", 500));
  }

  // Filter: >= 5 reviews and >= 4.0 rating
  const filtered = rows
    .filter((p) => {
      const avg = p.ratings?.average ?? 0;
      const total = p.ratings?.totalReviews ?? 0;
      return total >= 5 && avg >= 4;
    })
    .sort((a, b) => {
      const avgA = a.ratings?.average ?? 0;
      const avgB = b.ratings?.average ?? 0;
      const totalA = a.ratings?.totalReviews ?? 0;
      const totalB = b.ratings?.totalReviews ?? 0;

      if (avgB !== avgA) return avgB - avgA;
      return totalB - totalA;
    })
    .slice(0, 10);

  const products = mapProducts(filtered);

  res.status(200).json({
    success: true,
    data: products,
  });
});

/**
 * @desc Get related products (same category)
 * @route GET /api/products/:id/related
 * @access Public
 */
export const getRelatedProducts = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;

  if (!isValidUUID(productId)) {
    return next(new AppError("Invalid product ID format", 400));
  }

  const { data: productRow, error: productError } = await supabase
    .from("products")
    .select("id, category")
    .eq("id", productId)
    .eq("is_active", true)
    .single();

  if (productError && productError.code === "PGRST116") {
    logger.warn("Product not found for related products", { id: productId });
    return next(new AppError("No product found with that ID", 404));
  }
  if (productError) {
    logger.error("Error fetching product for related", {
      error: productError.message,
      id: productId,
    });
    return next(new AppError("Failed to fetch related products", 500));
  }

  const { data: relatedRows, error: relatedError } = await supabase
    .from("products")
    .select(
      "id, name, category, brand, final_price, images, ratings, is_active"
    )
    .eq("category", productRow.category)
    .eq("is_active", true)
    .neq("id", productRow.id)
    .limit(8);

  if (relatedError) {
    logger.error("Error fetching related products", {
      error: relatedError.message,
      id: productId,
    });
    return next(new AppError("Failed to fetch related products", 500));
  }

  const relatedProducts = mapProducts(relatedRows);

  res.status(200).json({
    success: true,
    results: relatedProducts.length,
    data: relatedProducts,
  });

  logger.info("Fetched related products", {
    id: productId,
    results: relatedProducts.length,
  });
});

/**
 * @desc Search products by name/description
 * @route GET /api/products/search
 * @access Public
 */
export const searchProducts = asyncHandler(async (req, res, next) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return next(
      new AppError("Search query must be at least 2 characters long", 400)
    );
  }

  const trimmed = q.trim();
  const escapedQuery = validator.escape(trimmed);

  if (escapedQuery.length < 2) {
    return next(
      new AppError("Search query must be at least 2 characters long", 400)
    );
  }

  const pattern = `%${escapedQuery}%`;

  const { data: rows, error } = await supabase
    .from("products")
    .select(
      "id, name, category, brand, final_price, images, ratings, is_active"
    )
    .eq("is_active", true)
    .or(`name.ilike.${pattern},description.ilike.${pattern}`)
    .limit(50);

  if (error) {
    logger.error("Error searching products", { error: error.message });
    return next(new AppError("Failed to search products", 500));
  }

  const products = mapProducts(rows);

  res.status(200).json({
    success: true,
    results: products.length,
    data: products,
  });
});

/**
 * @desc Get all unique product categories
 * @route GET /api/products/categories
 * @access Public
 */
export const getCategories = asyncHandler(async (req, res, next) => {
  const { data: rows, error } = await supabase
    .from("products")
    .select("category")
    .eq("is_active", true);

  if (error) {
    logger.error("Error fetching categories", { error: error.message });
    return next(new AppError("Failed to fetch categories", 500));
  }

  const set = new Set(rows.map((r) => r.category).filter(Boolean));
  const categories = Array.from(set);

  res.status(200).json({
    success: true,
    data: categories,
  });
});

/**
 * @desc Get featured products
 * @route GET /api/products/featured
 * @access Public
 */
export const getFeaturedProducts = asyncHandler(async (req, res, next) => {
  const { data: rows, error } = await supabase
    .from("products")
    .select(
      "id, name, category, brand, final_price, images, ratings, stock, is_active, is_featured"
    )
    .eq("is_featured", true)
    .eq("is_active", true)
    .gt("stock", 0)
    .limit(12);

  if (error) {
    logger.error("Error fetching featured products", { error: error.message });
    return next(new AppError("Failed to fetch featured products", 500));
  }

  const products = mapProducts(rows);

  res.status(200).json({
    success: true,
    data: products,
  });
});

/**
 * @desc Get products by category
 * @route GET /api/products/category/:category
 * @access Public
 */
export const getProductsByCategory = asyncHandler(async (req, res, next) => {
  const category = validator.escape(req.params.category);

  if (!VALID_CATEGORIES.includes(category)) {
    return next(new AppError("Invalid category", 400));
  }

  const { data: rows, error } = await supabase
    .from("products")
    .select(
      "id, name, category, brand, final_price, images, ratings, stock, is_active"
    )
    .eq("category", category)
    .eq("is_active", true);

  if (error) {
    logger.error("Error fetching products by category", {
      error: error.message,
      category,
    });
    return next(new AppError("Failed to fetch products", 500));
  }

  const products = mapProducts(rows);

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  });
});

// ============================================
// PROTECTED USER PRODUCT CONTROLLERS
// ============================================

/**
 * @desc Create product review
 * @route POST /api/products/:id/reviews
 * @access Private
 */
export const createProductReview = asyncHandler(async (req, res, next) => {
  req.body = sanitizeInput(req.body, { maxLength: 1000 });

  logger.info("Create review start", {
    productId: req.params.id,
    userId: req.user?.id,
  });

  const { rating, comment, title, media } = req.body;
  const productId = req.params.id;
  const userId = req.user.id;

  if (!isValidUUID(productId)) {
    return next(new AppError("Invalid product ID format", 400));
  }

  if (!rating || !comment || !title) {
    return next(new AppError("Please provide rating, title and comment", 400));
  }

  if (rating < 1 || rating > 5) {
    return next(new AppError("Rating must be between 1 and 5", 400));
  }

  if (title.length < 5 || title.length > 100) {
    return next(
      new AppError("Title must be between 5 and 100 characters", 400)
    );
  }

  if (comment.length < 10 || comment.length > 1000) {
    return next(
      new AppError("Comment must be between 10 and 1000 characters", 400)
    );
  }

  if (media && Array.isArray(media)) {
    for (const url of media) {
      if (
        !validator.isURL(url) ||
        !/\.(jpg|jpeg|png|gif|mp4|webm)$/i.test(url)
      ) {
        return next(new AppError("Invalid media URL format", 400));
      }
    }
  }

  try {
    // 1) Ensure product exists & active
    const { data: productRow, error: productError } = await supabase
      .from("products")
      .select("id, is_active")
      .eq("id", productId)
      .single();

    if (productError && productError.code === "PGRST116") {
      throw new AppError("No product found with that ID", 404);
    }
    if (productError) throw productError;
    if (!productRow.is_active) {
      throw new AppError("No product found with that ID", 404);
    }

    // 2) Check for existing active review
    const { data: existingReviews, error: existingError } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .eq("is_active", true)
      .limit(1);

    if (existingError) throw existingError;

    if (existingReviews && existingReviews.length > 0) {
      logger.warn("Duplicate review attempt", { productId, userId });
      throw new AppError("Product already reviewed", 400);
    }

    // 3) Check if user purchased the product
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("is_paid", true);

    if (ordersError) throw ordersError;

    let hasPurchased = false;
    if (orders && orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("id, order_id, product_id")
        .in("order_id", orderIds)
        .eq("product_id", productId)
        .limit(1);

      if (itemsError) throw itemsError;
      hasPurchased = !!(items && items.length > 0);
    }

    // 4) Create new review
    const { data: inserted, error: insertError } = await supabase
      .from("reviews")
      .insert([
        {
          user_id: userId,
          product_id: productId,
          rating: Number(rating),
          title,
          comment,
          verified_purchase: hasPurchased,
          media: media || [],
          is_active: true,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // 5) Recalculate product ratings
    await recalcProductRatings(productId);

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: inserted,
    });

    logger.info("Review created successfully", {
      productId,
      reviewId: inserted.id,
      userId,
    });
  } catch (error) {
    logger.error("Review creation failed", {
      error: error.message,
      productId: req.params.id,
      userId: req.user?.id,
    });

    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError("Failed to create review", 500));
  }
});

/**
 * @desc Add product to wishlist
 * @route POST /api/products/:id/wishlist
 * @access Private
 */
export const addToWishlist = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const userId = req.user.id;

  if (!isValidUUID(productId)) {
    return next(new AppError("Invalid product ID format", 400));
  }

  try {
    // Ensure product exists & active
    const { data: productRow, error: productError } = await supabase
      .from("products")
      .select("id, is_active")
      .eq("id", productId)
      .single();

    if (productError && productError.code === "PGRST116") {
      logger.warn("Wishlist add product not found", {
        id: productId,
        userId,
      });
      throw new AppError("No product found with that ID", 404);
    }
    if (productError) throw productError;
    if (!productRow.is_active) {
      throw new AppError("No product found with that ID", 404);
    }

    // Insert into wishlist
    const { error: insertError } = await supabase.from("user_wishlist").insert([
      {
        user_id: userId,
        product_id: productId,
      },
    ]);

    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }

    res.status(200).json({
      success: true,
      message: "Product added to wishlist",
    });

    logger.info("Wishlist added successfully", {
      productId,
      userId,
    });
  } catch (error) {
    logger.error("Wishlist add failed", {
      error: error.message,
      productId,
      userId,
    });

    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError("Failed to add to wishlist", 500));
  }
});

/**
 * @desc Remove product from wishlist
 * @route DELETE /api/products/:id/wishlist
 * @access Private
 */
export const removeFromWishlist = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const userId = req.user.id;

  if (!isValidUUID(productId)) {
    return next(new AppError("Invalid product ID format", 400));
  }

  try {
    const { error: deleteError } = await supabase
      .from("user_wishlist")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);

    if (deleteError) throw deleteError;

    res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
    });

    logger.info("Wishlist removed successfully", {
      productId,
      userId,
    });
  } catch (error) {
    logger.error("Wishlist remove failed", {
      error: error.message,
      productId,
      userId,
    });
    return next(new AppError("Failed to remove from wishlist", 500));
  }
});
