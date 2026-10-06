// File: server/controllers/productController.js
import asyncHandler from "express-async-handler";
import AppError from "../utils/appError.js";
import { logger } from "../middleware/logger.js";
import validator from "validator";
import { getSupabaseClient } from "../config/db.js";

// Import lightweight utilities from Product model
import { recalcProductRatings } from "../models/Product.js";
import { PRODUCT_FIELDS, GAME_FIELDS, PREBUILT_FIELDS, REVIEW_FIELDS, OWN_REVIEW_FIELDS, mapPublicReview } from "../utils/storefrontFields.js";
import { applyCatalogFilters, buildCatalogFacets, FACET_CANDIDATE_LIMIT, FACET_FIELDS, matchesSpecFilters, parseCatalogFilters } from "../utils/catalogFacets.js";

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

  // Parse specifications from object to array format
  let specifications = null;
  if (row.specifications) {
    try {
      const spec =
        typeof row.specifications === "string"
          ? JSON.parse(row.specifications)
          : row.specifications;

      // Convert object to array of {key, value} pairs
      if (spec && typeof spec === "object" && !Array.isArray(spec)) {
        specifications = Object.entries(spec).map(([key, value]) => ({
          key: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          value: Array.isArray(value) ? value.join(", ") : String(value),
        }));
      } else if (Array.isArray(spec)) {
        specifications = spec;
      }
    } catch (e) {
      logger.warn("Failed to parse specifications", {
        error: e.message,
        productId: row.id,
      });
    }
  }

  // Parse dimensions from object format
  let dimensions = null;
  if (row.dimensions) {
    try {
      const dim =
        typeof row.dimensions === "string"
          ? JSON.parse(row.dimensions)
          : row.dimensions;

      if (dim && typeof dim === "object") {
        dimensions = {
          length: dim.length_mm || dim.length || null,
          width: dim.width_mm || dim.width || null,
          height: dim.height_mm || dim.height || null,
        };
      }
    } catch (e) {
      logger.warn("Failed to parse dimensions", {
        error: e.message,
        productId: row.id,
      });
    }
  }

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    specifications,
    originalPrice: Number(row.original_price) || 0,
    discountPercentage: Number(row.discount_percentage) || 0,
    finalPrice: Number(row.final_price) || 0,
    stock: Number(row.stock) || 0,
    availability: row.availability,
    images: row.images,
    description: row.description,
    ratings: row.ratings,
    features: row.features,
    warranty: row.warranty,
    weight: row.weight ? Number(row.weight) : null,
    dimensions,
    sku: row.sku,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapProducts = (rows) => (Array.isArray(rows) ? rows.map(mapProduct) : []);

// ============================================
// PUBLIC PRODUCT CONTROLLERS
// ============================================

/**
 * @desc Get all products with advanced filtering, sorting, pagination
 * @route GET /api/products
 * @access Public
 */
export const getAllProducts = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  const filters = parseCatalogFilters(req.query);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20, 100));
  const from = (page - 1) * limit;
  const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "-created_at";
  const ascending = !sortRaw.startsWith("-");
  const sortMap = {finalPrice: "final_price", name: "name", createdAt: "created_at"};
  let sortField = sortMap[sortRaw.replace(/^-/, "")] || sortRaw.replace(/^-/, "");
  const publicSorts = new Set(["final_price", "original_price", "discount_percentage", "name", "created_at", "updated_at"]);
  if (!publicSorts.has(sortField)) sortField = "created_at";
  let rows, count, error;
  if (Object.keys(filters.specs).length) {
    // Normalize published JSON on the server, then count and page matching IDs.
    // The compact scan is bounded; never report a truncated candidate count.
    const candidates = await applyCatalogFilters(supabase.from("storefront_products").select(FACET_FIELDS, {count:"exact"}), filters)
      .order(sortField, {ascending}).order("id", {ascending:true}).range(0, FACET_CANDIDATE_LIMIT);
    if (candidates.error) return next(new AppError("Failed to load specification filters", 503));
    if (candidates.count === null || candidates.count > FACET_CANDIDATE_LIMIT || candidates.data.length !== candidates.count) {
      return next(new AppError(`Specification filters support up to ${FACET_CANDIDATE_LIMIT} candidates. Narrow your category, search or budget before applying specifications.`, 422));
    }
    const matching = candidates.data.filter((row) => matchesSpecFilters(row, filters.specs));
    count = matching.length;
    const ids = matching.slice(from, from + limit).map((row) => row.id);
    if (!ids.length) rows = [];
    else {
      const result = await applyCatalogFilters(supabase.from("storefront_products").select(PRODUCT_FIELDS), filters)
        .in("id", ids).order(sortField, {ascending}).order("id", {ascending:true});
      rows = result.data; error = result.error;
    }
  } else {
    const result = await applyCatalogFilters(supabase.from("storefront_products").select(PRODUCT_FIELDS, {count:"exact"}), filters)
      .order(sortField, {ascending}).order("id", {ascending:true}).range(from, from + limit - 1);
    rows = result.data; count = result.count; error = result.error;
  }
  if (error) {
    logger.error("Failed to fetch products", {message:error.message || String(error)});
    return next(new AppError("Failed to fetch products", 503));
  }
  const products = mapProducts(rows);
  res.status(200).json({success:true, page, limit, total:count ?? products.length, results:products.length, data:products});
});

/** Facet counts ignore brand/spec selections, retaining all other catalog filters. */
export const getCatalogFacets = asyncHandler(async (req, res, next) => {
  const filters = parseCatalogFilters(req.query);
  const {data: rows, count, error} = await applyCatalogFilters(getSupabaseClient(req).from("storefront_products")
    .select(FACET_FIELDS, {count:"exact"}), filters, {includeBrands:false}).range(0, FACET_CANDIDATE_LIMIT);
  if (error) return next(new AppError("Filter options are temporarily unavailable", 503));
  const complete = count !== null && count <= FACET_CANDIDATE_LIMIT && rows.length === count;
  res.json({success:true, data:{
    available:complete,
    candidateLimit:FACET_CANDIDATE_LIMIT,
    scopeTotal:count,
    scope:"Counts reflect category, search, price, stock, rating and deal filters before brand or specification selections.",
    ...(complete ? buildCatalogFacets(rows, filters.category) : {brands:[], specs:[]}),
    reason:complete ? null : `Narrow your category, search or budget to ${FACET_CANDIDATE_LIMIT} products or fewer to see specification options and exact facet counts.`,
  }});
});

/**
 * @desc Get single product with reviews, game & PC details
 * @route GET /api/products/:id
 * @access Public
 */
export const getProduct = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  const productId = req.params.id;

  if (!isValidUUID(productId)) {
    logger.warn("Invalid product ID format", { id: productId });
    return next(new AppError("Invalid product ID format", 400));
  }

  try {
    // 1) Get product
    const { data: productRow, error: productError } = await supabase
      .from("storefront_products")
      .select(PRODUCT_FIELDS)
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
      .from("storefront_reviews")
      .select(REVIEW_FIELDS)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (reviewsError) throw reviewsError;

    const mappedReviews = reviewRows.map(mapPublicReview);

    // 4) Game details (if any)
    const { data: gameRow, error: gameError } = await supabase
      .from("storefront_games")
      .select(GAME_FIELDS)
      .eq("product_id", productId)
      .maybeSingle();

    if (gameError) throw gameError;

    // 5) Prebuilt PC details (if any)
    const { data: pcRow, error: pcError } = await supabase
      .from("storefront_prebuilt_pcs")
      .select(PREBUILT_FIELDS)
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
  const supabase = getSupabaseClient(req);
  const { data: rows, error } = await supabase
    .from("storefront_products")
    .select(PRODUCT_FIELDS)
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
  const supabase = getSupabaseClient(req);
  const productId = req.params.id;

  if (!isValidUUID(productId)) {
    return next(new AppError("Invalid product ID format", 400));
  }

  const { data: productRow, error: productError } = await supabase
    .from("storefront_products")
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
    .from("storefront_products")
    .select(PRODUCT_FIELDS)
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
  const supabase = getSupabaseClient(req);
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
    .from("storefront_products")
    .select(PRODUCT_FIELDS)
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
  const supabase = getSupabaseClient(req);
  const { data: rows, error } = await supabase
    .from("storefront_categories")
    .select("category");

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
export const getBrands = asyncHandler(async (req, res, next) => {
  const {data, error} = await getSupabaseClient(req).from("storefront_brands").select("brand").order("brand");
  if (error) return next(new AppError("Failed to fetch brands", 500));
  res.json({success: true, data: data.map(row => row.brand)});
});

export const getFeaturedProducts = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  const { data: rows, error } = await supabase
    .from("storefront_products")
    .select(PRODUCT_FIELDS)
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
  const supabase = getSupabaseClient(req);
  const category = validator.escape(req.params.category);

  if (!VALID_CATEGORIES.includes(category)) {
    return next(new AppError("Invalid category", 400));
  }

  const { data: rows, error } = await supabase
    .from("storefront_products")
    .select(PRODUCT_FIELDS)
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
  const supabase = getSupabaseClient(req);
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

    // 2) Pending and withdrawn reviews remain editable; do not duplicate them.
    const { data: existingReviews, error: existingError } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .limit(1);

    if (existingError) throw existingError;

    if (existingReviews && existingReviews.length > 0) {
      logger.warn("Duplicate review attempt", { productId, userId });
      throw new AppError("You already submitted a review. Edit your existing review.", 409);
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
          is_active: false, // Pending moderation; only admin approval publishes reviews.
        },
      ])
      .select(OWN_REVIEW_FIELDS)
      .single();

    if (insertError) throw insertError;

    // 5) Recalculate product ratings
    await recalcProductRatings(productId, supabase);

    res.status(201).json({
      success: true,
      message: "Review submitted for approval",
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
  const supabase = getSupabaseClient(req);
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
  const supabase = getSupabaseClient(req);
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
