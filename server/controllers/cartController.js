// server/controllers/cartController.js

import asyncHandler from "express-async-handler";
import AppError from "../utils/appError.js";
import { logger } from "../middleware/logger.js";
import { getSupabaseClient } from "../config/db.js";

// Coupon helpers (Supabase model)
// These should be implemented in ../models/Coupon.js in Supabase style
import {
  findActiveCouponByCode,
  isCouponCurrentlyValid,
  isCouponApplicableToProducts,
  computeCouponDiscount,
  mapCouponRow,
} from "../models/Coupon.js";

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------
const CART_CONFIG = {
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 10,
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const isValidUUID = (value) =>
  typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);

const validateQuantity = (quantity, fieldName = "quantity") => {
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }
  if (!Number.isInteger(qty)) {
    throw new AppError(`${fieldName} must be an integer`, 400);
  }
  if (qty < CART_CONFIG.MIN_QUANTITY) {
    throw new AppError(
      `${fieldName} must be at least ${CART_CONFIG.MIN_QUANTITY}`,
      400
    );
  }
  if (qty > CART_CONFIG.MAX_QUANTITY) {
    throw new AppError(
      `${fieldName} must not exceed ${CART_CONFIG.MAX_QUANTITY}`,
      400
    );
  }
  return qty;
};

/**
 * Create or get cart row for user (no joins)
 */
const getOrCreateCartRow = async (supabase, userId) => {
  if (!isValidUUID(userId)) {
    throw new AppError("Valid user ID is required", 400);
  }

  // Try to get existing cart
  let { data: cart, error } = await supabase
    .from("carts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!cart) {
    // Create new cart
    const { data: newCart, error: insertError } = await supabase
      .from("carts")
      .insert([{ user_id: userId }])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);
    cart = newCart;
  }

  return cart;
};

/**
 * Load cart with items, products and coupon populated
 */
const loadCartWithDetails = async (supabase, userId) => {
  if (!isValidUUID(userId)) {
    throw new AppError("Valid user ID is required", 400);
  }

  const { data: cart, error } = await supabase
    .from("carts")
    .select(
      `
      id,
      user_id,
      coupon:coupon_id (
        id,
        code,
        discount_type,
        discount_value,
        min_purchase,
        max_discount,
        valid_from,
        valid_to,
        is_active,
        usage_limit,
        times_used,
        per_user_limit,
        applicable_products,
        excluded_products,
        description
      ),
      items:cart_items (
        id,
        quantity,
        product:products (
          id,
          name,
          images,
          original_price,
          final_price,
          stock,
          is_active
        )
      )
    `
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!cart) {
    // If cart row didn't exist, create and return empty cart
    const baseCart = await getOrCreateCartRow(supabase, userId);
    return {
      id: baseCart.id,
      user_id: baseCart.user_id,
      coupon: null,
      items: [],
    };
  }

  // Normalize items array
  cart.items = cart.items || [];
  return cart;
};

/**
 * Compute totals (subtotal, discount, finalPrice) for a cart object
 * cart = {
 *   items: [ { quantity, product: { id, name, images, final_price, stock, is_active } } ],
 *   coupon: {...} | null
 * }
 */
export const computeCartTotals = (cart) => {
  if (!cart) {
    throw new AppError("Cart is required for total calculation", 500);
  }

  const items = [];
  let subtotal = 0;
  const warnings = [];

  for (const cartItem of cart.items) {
    const product = cartItem.product;
    const qty = Number(cartItem.quantity) || 0;

    if (!product || !product.is_active) {
      warnings.push({
        type: "product",
        productId: product?.id || null,
        message: "Product no longer available",
      });
      continue;
    }

    // Use final_price if available, otherwise fall back to original_price
    const unitPrice = Number(product.final_price ?? product.original_price ?? 0);
    const lineTotal = unitPrice * qty;

    items.push({
      product: {
        id: product.id,
        name: product.name,
        image: Array.isArray(product.images) ? product.images[0] : null,
      },
      quantity: qty,
      unitPrice,
      lineTotal,
      availableStock: typeof product.stock === "number" ? product.stock : null,
    });

    subtotal += lineTotal;

    if (typeof product.stock === "number" && product.stock < qty) {
      warnings.push({
        type: "stock",
        productId: product.id,
        message: `Only ${product.stock} unit(s) available for ${product.name}`,
      });
    }
  }

  let discount = 0;
  let couponSummary = null;
  let couponError = null;

  if (cart.coupon) {
    // Joined cart rows are snake_case; findActiveCouponByCode returns a DTO.
    const coupon = 'discount_type' in cart.coupon ? mapCouponRow(cart.coupon) : cart.coupon;
    const now = new Date();

    // 1) Basic validity (active, date range, usage limits)
    const basicValidity = isCouponCurrentlyValid(coupon, now);

    if (!basicValidity.valid) {
      couponError = basicValidity.reason;
    } else if (coupon.minPurchase && subtotal < Number(coupon.minPurchase)) {
      couponError = `Minimum order amount for this coupon is ${Number(
        coupon.minPurchase
      ).toFixed(2)}`;
    } else {
      // 2) Product-level applicability
      const productIds = items.map((it) => it.product.id);
      const applicability = isCouponApplicableToProducts(coupon, productIds);

      if (!applicability.valid) {
        couponError = applicability.reason;
      } else {
        // 3) Compute discount amount
        discount = computeCouponDiscount(coupon, subtotal);
        couponSummary = {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: Number(coupon.discountValue),
          discountAmount: discount,
        };
      }
    }
  }

  // Match checkout_cart's current policy: $10 below $100 after discounts,
  // otherwise free shipping, and 10% tax on the discounted merchandise.
  // Use integer cents for addition and tax rounding. Checkout still revalidates
  // prices/coupons/stock transactionally; this endpoint does not reserve stock.
  const subtotalCents = Math.round((subtotal + Number.EPSILON * subtotal) * 100);
  const discountCents = Math.round((discount + Number.EPSILON * discount) * 100);
  const netCents = Math.max(0, subtotalCents - discountCents);
  const shippingCents = items.length && netCents < 10000 ? 1000 : 0;
  const taxCents = Math.round(netCents / 10);

  return {
    items,
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    finalPrice: netCents / 100, // Compatibility: merchandise after discount.
    shipping: shippingCents / 100,
    tax: taxCents / 100,
    total: (netCents + shippingCents + taxCents) / 100,
    coupon: couponSummary,
    couponError,
    warnings: warnings.length ? warnings : undefined,
  };
};

// ------------------------------------------------------------------
// Controllers
// ------------------------------------------------------------------

/**
 * GET /api/cart
 * Get current user's cart with totals
 */
export const getCart = asyncHandler(async (req, res) => {
  const supabase = getSupabaseClient(req);
  logger.info("Get cart", { userId: req.user.id });

  const cart = await loadCartWithDetails(supabase, req.user.id);
  const totals = computeCartTotals(cart);

  res.status(200).json({
    success: true,
    data: {
      cart,
      totals,
    },
  });
});

/**
 * POST /api/cart
 * Add product to cart or increment quantity
 * body: { productId, quantity }
 */
export const addToCart = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  logger.info("Add to cart", { userId: req.user.id });

  const rawProductId = req.body.productId || req.body.product;
  if (!rawProductId || !isValidUUID(rawProductId)) {
    throw new AppError("Valid product ID is required", 400);
  }
  const productId = rawProductId;

  const quantity = validateQuantity(req.body.quantity ?? 1);

  try {
    // 1) Ensure product exists & active
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, original_price, final_price, images, stock, is_active, name")
      .eq("id", productId)
      .single();

    if (productError && productError.code === "PGRST116") {
      throw new AppError("Product not found", 404);
    }
    if (productError) throw productError;

    if (!product.is_active) {
      throw new AppError("Product not available", 400);
    }

    // 2) Get or create cart row
    const cartRow = await getOrCreateCartRow(supabase, req.user.id);

    // 3) Check existing cart item
    const { data: existingItem, error: existingError } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartRow.id)
      .eq("product_id", productId)
      .maybeSingle();

    if (existingError) throw existingError;

    let newQuantity = quantity;
    if (existingItem) {
      newQuantity = existingItem.quantity + quantity;
      if (newQuantity > CART_CONFIG.MAX_QUANTITY) {
        newQuantity = CART_CONFIG.MAX_QUANTITY;
      }
    }

    if (typeof product.stock === "number" && product.stock < newQuantity) {
      throw new AppError(
        `Requested quantity exceeds available stock (max ${product.stock})`,
        400
      );
    }

    // 4) Insert or update
    if (!existingItem) {
      const { error: insertError } = await supabase.from("cart_items").insert([
        {
          cart_id: cartRow.id,
          product_id: productId,
          quantity: newQuantity,
        },
      ]);

      if (insertError) throw insertError;
    } else {
      const { error: updateError } = await supabase
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", existingItem.id);

      if (updateError) throw updateError;
    }

    // 5) Reload cart with populated details
    const populatedCart = await loadCartWithDetails(supabase, req.user.id);
    const totals = computeCartTotals(populatedCart);

    res.status(200).json({
      success: true,
      message: "Product added to cart",
      data: {
        cart: populatedCart,
        totals,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);

    logger.error("Add to cart failed", {
      error: err.message,
      userId: req.user.id,
      productId,
    });
    return next(new AppError("Failed to add product to cart", 500));
  }
});

/**
 * PATCH /api/cart/update
 * Update cart item quantity
 * body: { productId, quantity }
 */
export const updateCartItem = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  logger.info("Update cart item", { userId: req.user.id });

  const rawProductId = req.body.productId || req.body.product;
  if (!rawProductId || !isValidUUID(rawProductId)) {
    throw new AppError("Valid product ID is required", 400);
  }
  const productId = rawProductId;

  const quantity = validateQuantity(req.body.quantity);

  try {
    const cartRow = await getOrCreateCartRow(supabase, req.user.id);

    // Check existing cart item
    const { data: existingItem, error: existingError } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartRow.id)
      .eq("product_id", productId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existingItem) {
      throw new AppError("Product not found in cart", 404);
    }

    // Ensure product exists and has enough stock
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, stock, is_active, name")
      .eq("id", productId)
      .single();

    if (productError && productError.code === "PGRST116") {
      throw new AppError("Product not found", 404);
    }
    if (productError) throw productError;

    if (!product.is_active) {
      throw new AppError("Product not available", 400);
    }

    if (typeof product.stock === "number" && product.stock < quantity) {
      throw new AppError(
        `Requested quantity exceeds available stock (max ${product.stock})`,
        400
      );
    }

    // Update quantity
    const { error: updateError } = await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", existingItem.id);

    if (updateError) throw updateError;

    const populatedCart = await loadCartWithDetails(supabase, req.user.id);
    const totals = computeCartTotals(populatedCart);

    res.status(200).json({
      success: true,
      message: "Cart item updated",
      data: {
        cart: populatedCart,
        totals,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);

    logger.error("Update cart item failed", {
      error: err.message,
      userId: req.user.id,
      productId,
    });
    return next(new AppError("Failed to update cart item", 500));
  }
});

/**
 * DELETE /api/cart/remove/:id
 * Remove item from cart
 */
export const removeFromCart = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  logger.info("Remove from cart", { userId: req.user.id });

  const rawProductId = req.params.id || req.body.productId || req.body.product;
  if (!rawProductId || !isValidUUID(rawProductId)) {
    throw new AppError("Valid product ID is required", 400);
  }
  const productId = rawProductId;

  try {
    const cartRow = await getOrCreateCartRow(supabase, req.user.id);

    const { data: item, error: itemError } = await supabase
      .from("cart_items")
      .select("id")
      .eq("cart_id", cartRow.id)
      .eq("product_id", productId)
      .maybeSingle();

    if (itemError) throw itemError;

    if (!item) {
      throw new AppError("Product not found in cart", 404);
    }

    const { error: deleteError } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", item.id);

    if (deleteError) throw deleteError;

    const populatedCart = await loadCartWithDetails(supabase, req.user.id);
    const totals = computeCartTotals(populatedCart);

    res.status(200).json({
      success: true,
      message: "Product removed from cart",
      data: {
        cart: populatedCart,
        totals,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);

    logger.error("Remove from cart failed", {
      error: err.message,
      userId: req.user.id,
      productId,
    });
    return next(new AppError("Failed to remove product from cart", 500));
  }
});

/**
 * DELETE /api/cart
 * Clear entire cart
 */
export const clearCart = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  logger.info("Clear cart", { userId: req.user.id });

  try {
    const cartRow = await getOrCreateCartRow(supabase, req.user.id);

    // Delete all items
    const { error: itemsError } = await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cartRow.id);

    if (itemsError) throw itemsError;

    // Remove coupon
    const { error: cartUpdateError } = await supabase
      .from("carts")
      .update({ coupon_id: null })
      .eq("id", cartRow.id);

    if (cartUpdateError) throw cartUpdateError;

    const populatedCart = await loadCartWithDetails(supabase, req.user.id);
    const totals = computeCartTotals(populatedCart);

    res.status(200).json({
      success: true,
      message: "Cart cleared",
      data: {
        cart: populatedCart,
        totals,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);

    logger.error("Clear cart failed", {
      error: err.message,
      userId: req.user.id,
    });
    return next(new AppError("Failed to clear cart", 500));
  }
});

/**
 * POST /api/cart/coupon
 * Apply coupon to cart (preview only; final validation at checkout)
 * body: { code }
 */
export const applyCoupon = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  const rawCode = req.body.code || req.body.couponCode;
  if (!rawCode || typeof rawCode !== "string") {
    throw new AppError("Coupon code is required", 400);
  }

  const code = rawCode.trim().toUpperCase();
  logger.info("Apply coupon to cart", { userId: req.user.id, code });

  try {
    // 1) Load cart with items
    const cart = await loadCartWithDetails(supabase, req.user.id);

    if (!cart.items || cart.items.length === 0) {
      throw new AppError("Cannot apply coupon to an empty cart", 400);
    }

    // 2) Fetch active coupon from DB (with Supabase logic in Coupon model)
    const coupon = await findActiveCouponByCode(code, supabase);
    if (!coupon) {
      throw new AppError("Invalid or expired coupon", 400);
    }

    // 3) Attach coupon temporarily and compute totals
    const tempCart = { ...cart, coupon };
    const totals = computeCartTotals(tempCart);

    if (totals.couponError) {
      throw new AppError(
        `Coupon cannot be applied: ${totals.couponError}`,
        400
      );
    }

    // 4) Persist coupon relation on cart
    const cartRow = await getOrCreateCartRow(supabase, req.user.id);
    const { error: updateError } = await supabase
      .from("carts")
      .update({ coupon_id: coupon.id })
      .eq("id", cartRow.id);

    if (updateError) throw updateError;

    // Reload final cart with coupon populated
    const finalCart = await loadCartWithDetails(supabase, req.user.id);
    const finalTotals = computeCartTotals(finalCart);

    res.status(200).json({
      success: true,
      message: "Coupon applied to cart",
      data: {
        cart: finalCart,
        totals: finalTotals,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);

    logger.error("Apply coupon failed", {
      error: err.message,
      userId: req.user.id,
      code,
    });
    return next(new AppError("Failed to apply coupon", 500));
  }
});

/**
 * DELETE /api/cart/coupon
 * Remove coupon from cart
 */
export const removeCoupon = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  logger.info("Remove coupon from cart", { userId: req.user.id });

  try {
    const cartRow = await getOrCreateCartRow(supabase, req.user.id);

    // Remove coupon reference
    const { error: updateError } = await supabase
      .from("carts")
      .update({ coupon_id: null })
      .eq("id", cartRow.id);

    if (updateError) throw updateError;

    const finalCart = await loadCartWithDetails(supabase, req.user.id);
    const totals = computeCartTotals(finalCart);

    res.status(200).json({
      success: true,
      message: "Coupon removed from cart",
      data: {
        cart: finalCart,
        totals,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);

    logger.error("Remove coupon failed", {
      error: err.message,
      userId: req.user.id,
    });
    return next(new AppError("Failed to remove coupon", 500));
  }
});
