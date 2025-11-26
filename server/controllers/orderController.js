// server/controllers/orderController.js
import asyncHandler from "express-async-handler";
import AppError from "../utils/appError.js";
import { logger } from "../middleware/logger.js";
import { supabase } from "../config/db.js";
import Email from "../utils/email.js";
import { changeStock, increaseSales } from "../models/Product.js";
import {
  isCouponCurrentlyValid,
  isCouponApplicableToProducts,
  computeCouponDiscount,
  incrementCouponUsage,
} from "../models/Coupon.js";

const ORDER_CONFIG = {
  FREE_SHIPPING_THRESHOLD: 100,
  FLAT_SHIPPING_RATE: 10,
  TAX_RATE: 0.1, // 10%
  RETURN_WINDOW_DAYS: 30,
  MAX_ORDER_ITEMS: 50,
};

// ---------------------------------------------
// Helpers
// ---------------------------------------------
const isValidUUID = (value) =>
  typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);

function validateShippingAddress(address) {
  if (!address) {
    throw new AppError("Shipping address is required", 400);
  }

  const required = [
    "fullName",
    "address",
    "city",
    "state",
    "postalCode",
    "country",
  ];
  for (const field of required) {
    if (!address[field] || String(address[field]).trim().length === 0) {
      throw new AppError(`Shipping address ${field} is required`, 400);
    }
  }
}

// Load address JSON by ID from user_addresses
const loadAddressById = async (userId, addressId) => {
  if (!isValidUUID(addressId)) {
    throw new AppError("Invalid shippingAddressId", 400);
  }

  const { data, error } = await supabase
    .from("user_addresses")
    .select("*")
    .eq("id", addressId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new AppError("Shipping address not found", 404);
  }

  // Remove DB metadata
  const { id, user_id, is_default, ...cleaned } = data;
  return {
    fullName: cleaned.full_name,
    address: cleaned.address,
    city: cleaned.city,
    state: cleaned.state,
    postalCode: cleaned.postal_code,
    country: cleaned.country,
    phoneNumber: cleaned.phone_number,
  };
};

function calculateOrderPrices(itemsPrice, discountAmount = 0) {
  const subtotal = Number(itemsPrice) || 0;
  const discount = Number(discountAmount) || 0;

  const priceAfterDiscount = Math.max(0, subtotal - discount);

  const shippingPrice =
    priceAfterDiscount >= ORDER_CONFIG.FREE_SHIPPING_THRESHOLD
      ? 0
      : ORDER_CONFIG.FLAT_SHIPPING_RATE;

  const taxPrice = Number(
    (priceAfterDiscount * ORDER_CONFIG.TAX_RATE).toFixed(2)
  );
  const totalPrice = Number(
    (priceAfterDiscount + shippingPrice + taxPrice).toFixed(2)
  );

  return {
    itemsPrice: Number(subtotal.toFixed(2)),
    discountAmount: Number(discount.toFixed(2)),
    shippingPrice: Number(shippingPrice.toFixed(2)),
    taxPrice,
    totalPrice,
  };
}

function validateOrderOwnership(order, userId, userRole) {
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  const orderUserId = String(order.user_id);
  const requestUserId = String(userId);

  if (orderUserId !== requestUserId && userRole !== "admin") {
    throw new AppError("Not authorized to access this order", 403);
  }
}

function generateIdempotencyKey(userId) {
  return `order_${userId}_${Date.now()}`;
}

/**
 * Normalize raw coupon row (snake_case) into coupon domain object
 * expected by Coupon model helpers.
 */
function normalizeCouponRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    minPurchase: row.min_purchase,
    maxDiscount: row.max_discount,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    isActive: row.is_active,
    usageLimit: row.usage_limit,
    timesUsed: row.times_used,
    perUserLimit: row.per_user_limit,
    applicableProducts: row.applicable_products || [],
    excludedProducts: row.excluded_products || [],
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Load user's cart with items, products and coupon details
 */
const loadCartWithDetails = async (userId) => {
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
        description,
        created_at,
        updated_at
      ),
      items:cart_items (
        id,
        quantity,
        product:products (
          id,
          name,
          images,
          final_price,
          stock,
          is_active
        )
      )
    `
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!cart) {
    return {
      id: null,
      user_id: userId,
      coupon: null,
      items: [],
    };
  }

  cart.items = cart.items || [];
  return cart;
};

/**
 * Validate coupon at checkout (Supabase version of original logic)
 */
const validateCouponAtCheckout = async ({
  couponRow,
  userId,
  itemsPrice,
  orderItems,
}) => {
  if (!couponRow) {
    return { discountAmount: 0, couponApplied: null, normalizedCoupon: null };
  }

  const coupon = normalizeCouponRow(couponRow);
  const now = new Date();

  // 1. Basic validity (active, dates, global usage)
  const validity = isCouponCurrentlyValid(coupon, now);
  if (!validity.valid) {
    throw new AppError(`Coupon is not valid: ${validity.reason}`, 400);
  }

  // 2. Min purchase
  if (coupon.minPurchase && itemsPrice < coupon.minPurchase) {
    throw new AppError(
      `Order does not meet the minimum purchase amount of ${coupon.minPurchase.toFixed(
        2
      )}`,
      400
    );
  }

  // 3. Product restrictions
  const productIds = orderItems.map((item) => item.productId);
  const applicability = isCouponApplicableToProducts(coupon, productIds);
  if (!applicability.valid) {
    throw new AppError(applicability.reason, 400);
  }

  // 4. Per-user usage limit (based on past successful orders)
  if (coupon.perUserLimit) {
    const { data: userOrders, error: usageError } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .eq("coupon_applied->>code", coupon.code);

    if (usageError) {
      throw new Error(usageError.message);
    }

    const userUsageCount = userOrders ? userOrders.length : 0;
    if (userUsageCount >= coupon.perUserLimit) {
      throw new AppError(
        "You have already used this coupon the maximum allowed times",
        400
      );
    }
  }

  // 5. Compute discount
  const discountAmount = computeCouponDiscount(coupon, itemsPrice);

  const couponApplied = {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountAmount: Number(discountAmount.toFixed(2)),
  };

  return { discountAmount, couponApplied, normalizedCoupon: coupon };
};

// ---------------------------------------------
// Controllers
// ---------------------------------------------

/**
 * POST /api/orders
 * Create new order from cart
 */
export const createOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  logger.info("Create order request", { userId });

  const {
    shippingAddress,
    paymentMethod = "stripe",
    idempotencyKey,
    shippingAddressId,
  } = req.body;

  // ---------------------------------------------
  // SHIPPING ADDRESS HANDLING
  // ---------------------------------------------
  let finalShippingAddress = null;

  // Case 1: Full JSON provided
  if (shippingAddress) {
    validateShippingAddress(shippingAddress);
    finalShippingAddress = shippingAddress;
  }

  // Case 2: shippingAddressId provided (fetch from DB)
  if (!finalShippingAddress && shippingAddressId) {
    finalShippingAddress = await loadAddressById(
      req.user.id,
      shippingAddressId
    );
    validateShippingAddress(finalShippingAddress);
  }

  // Case 3: No shipping info at all
  if (!finalShippingAddress) {
    throw new AppError(
      "Shipping address is required (provide shippingAddress or shippingAddressId)",
      400
    );
  }

  const validPaymentMethods = ["stripe", "paypal", "cod"];
  if (!validPaymentMethods.includes(paymentMethod)) {
    throw new AppError("Invalid payment method", 400);
  }

  // Idempotency check
  if (idempotencyKey) {
    const { data: existingOrder, error: existingError } = await supabase
      .from("orders")
      .select(
        `
        *,
        items:order_items (*)
      `
      )
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) {
      logger.error("Idempotency lookup failed", {
        error: existingError.message,
        userId,
        idempotencyKey,
      });
    }

    if (existingOrder) {
      logger.info("Idempotent order reused", {
        userId,
        orderId: existingOrder.id,
      });
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: existingOrder,
      });
    }
  }

  try {
    // 1. Load cart with product & coupon details
    const cart = await loadCartWithDetails(userId);

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError(
        "Cart is empty. Please add items before checkout.",
        400
      );
    }

    if (cart.items.length > ORDER_CONFIG.MAX_ORDER_ITEMS) {
      throw new AppError(
        `Cannot create order with more than ${ORDER_CONFIG.MAX_ORDER_ITEMS} items`,
        400
      );
    }

    // 2. Build order items & verify stock
    const orderItemsPayload = [];
    const outOfStock = [];
    const removedProducts = [];
    let itemsPrice = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;
      const quantity = Number(cartItem.quantity) || 0;

      if (!product || !product.is_active) {
        removedProducts.push(product?.id || null);
        continue;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      if (typeof product.stock === "number" && product.stock < quantity) {
        outOfStock.push({
          productId: product.id,
          available: product.stock,
        });
        continue;
      }

      const unitPrice = Number(product.final_price || 0);
      const lineTotal = unitPrice * quantity;

      orderItemsPayload.push({
        productId: product.id,
        name: product.name,
        image: Array.isArray(product.images) ? product.images[0] : null,
        price: unitPrice,
        quantity,
        priceSnapshot: unitPrice,
      });

      itemsPrice += lineTotal;
    }

    if (removedProducts.length > 0) {
      throw new AppError(
        "One or more products in your cart are no longer available. Please review your cart.",
        400
      );
    }

    if (outOfStock.length > 0) {
      throw new AppError(
        "Some items in your cart do not have enough stock. Please adjust quantities.",
        400
      );
    }

    if (orderItemsPayload.length === 0) {
      throw new AppError(
        "No valid items left in cart to create an order.",
        400
      );
    }

    // 3. Coupon validation
    let discountAmount = 0;
    let couponApplied = null;
    let normalizedCoupon = null;

    if (cart.coupon) {
      const result = await validateCouponAtCheckout({
        couponRow: cart.coupon,
        userId,
        itemsPrice,
        orderItems: orderItemsPayload,
      });

      discountAmount = result.discountAmount;
      couponApplied = result.couponApplied;
      normalizedCoupon = result.normalizedCoupon;
    }

    // 4. Compute final prices
    const prices = calculateOrderPrices(itemsPrice, discountAmount);

    // 5. Create order row
    const orderPayload = {
      user_id: userId,
      shipping_address: finalShippingAddress,
      payment_method: paymentMethod,
      items_price: prices.itemsPrice,
      discount_amount: prices.discountAmount,
      shipping_price: prices.shippingPrice,
      tax_price: prices.taxPrice,
      total_price: prices.totalPrice,
      coupon_applied: couponApplied,
      is_paid: false,
      is_delivered: false,
      status: "pending",
      idempotency_key: idempotencyKey || generateIdempotencyKey(userId),
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([orderPayload])
      .select("*")
      .single();

    if (orderError) {
      throw new Error(orderError.message);
    }

    // 6. Insert order_items
    const orderItemsRows = orderItemsPayload.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      price_snapshot: item.priceSnapshot,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsRows);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    // 7. Stock & sales updates via RPC
    for (const item of orderItemsPayload) {
      try {
        await changeStock(item.productId, -item.quantity);
        await increaseSales(item.productId, item.quantity);
      } catch (rpcError) {
        logger.error("Stock/sales update failed", {
          error: rpcError.message,
          productId: item.productId,
          quantity: item.quantity,
        });
      }
    }

    // 8. Increment coupon usage if applicable
    if (normalizedCoupon) {
      try {
        await incrementCouponUsage(normalizedCoupon.id);
      } catch (couponError) {
        logger.error("Increment coupon usage failed", {
          error: couponError.message,
          couponId: normalizedCoupon.id,
        });
      }
    }

    // 9. Clear cart: items + coupon
    if (cart.id) {
      const { error: deleteItemsError } = await supabase
        .from("cart_items")
        .delete()
        .eq("cart_id", cart.id);
      if (deleteItemsError) {
        logger.error("Failed to clear cart items after order", {
          error: deleteItemsError.message,
          cartId: cart.id,
        });
      }

      const { error: clearCouponError } = await supabase
        .from("carts")
        .update({ coupon_id: null })
        .eq("id", cart.id);
      if (clearCouponError) {
        logger.error("Failed to clear cart coupon after order", {
          error: clearCouponError.message,
          cartId: cart.id,
        });
      }
    }

    // 10. Send confirmation email asynchronously
    setImmediate(async () => {
      try {
        const email = new Email(
          req.user,
          `${process.env.FRONTEND_URL}/orders/${order.id}`
        );
        await email.sendOrderConfirmation(order);
      } catch (err) {
        logger.error("Order confirmation email failed", {
          orderId: order.id,
          error: err.message,
        });
      }
    });

    // Attach items to response
    order.orderItems = orderItemsRows;

    res.status(201).json({
      success: true,
      data: order,
      message: "Order created successfully",
    });
  } catch (err) {
    logger.error("Order creation failed", {
      userId,
      error: err.message,
    });

    if (err instanceof AppError) {
      return next(err);
    }

    return next(new AppError("Failed to create order", 500));
  }
});

/**
 * GET /api/orders/:id
 * Get order by ID (user or admin)
 */
export const getOrderById = asyncHandler(async (req, res, next) => {
  const orderId = req.params.id;

  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      user:users (
        id,
        name,
        email
      ),
      items:order_items (
        id,
        product_id,
        name,
        image,
        price,
        quantity,
        price_snapshot
      )
    `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    logger.error("Get order by ID failed", {
      error: error.message,
      orderId,
    });
    return next(new AppError("Failed to fetch order", 500));
  }

  validateOrderOwnership(order, req.user.id, req.user.role);

  res.status(200).json({
    success: true,
    data: order,
  });
});

/**
 * GET /api/orders/my
 * Get USER orders with advanced filtering + sorting + pagination
 */
export const getMyOrders = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  logger.info("User fetching orders with filters", {
    userId,
    query: req.query,
  });

  // ---------------------------------------------
  // 1. SANITIZE FILTERS
  // ---------------------------------------------
  const filters = {
    status: req.query.status || null, // pending, paid, delivered, cancelled
    isPaid:
      typeof req.query.isPaid !== "undefined"
        ? req.query.isPaid === "true"
        : null,
    isDelivered:
      typeof req.query.isDelivered !== "undefined"
        ? req.query.isDelivered === "true"
        : null,
    minTotal: req.query.minTotal ? Number(req.query.minTotal) : null,
    maxTotal: req.query.maxTotal ? Number(req.query.maxTotal) : null,
    createdFrom: req.query.createdFrom ? new Date(req.query.createdFrom) : null,
    createdTo: req.query.createdTo ? new Date(req.query.createdTo) : null,
    q: req.query.q ? req.query.q.trim() : null, // search by product name
  };

  // ---------------------------------------------
  // 2. PAGINATION
  // ---------------------------------------------
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // ---------------------------------------------
  // 3. SORTING
  // ---------------------------------------------
  let sortRaw = req.query.sort || "-createdAt";
  let ascending = !sortRaw.startsWith("-");
  let sortField = sortRaw.replace(/^-/, "");

  const sortMap = {
    createdAt: "created_at",
    totalPrice: "total_price",
    status: "status",
  };
  sortField = sortMap[sortField] || "created_at";

  // ---------------------------------------------
  // 4. BUILD QUERY
  // ---------------------------------------------
  let query = supabase
    .from("orders")
    .select(
      `
      id,
      created_at,
      status,
      is_paid,
      is_delivered,
      total_price,
      coupon_applied,
      items:order_items (id, product_id, name, price, quantity, image)
     `,
      { count: "exact" }
    )
    .eq("user_id", userId);

  // ---------------------------------------------
  // 5. APPLY FILTERS
  // ---------------------------------------------
  if (filters.status) query = query.eq("status", filters.status);

  if (filters.isPaid !== null) query = query.eq("is_paid", filters.isPaid);

  if (filters.isDelivered !== null)
    query = query.eq("is_delivered", filters.isDelivered);

  if (filters.minTotal !== null)
    query = query.gte("total_price", filters.minTotal);

  if (filters.maxTotal !== null)
    query = query.lte("total_price", filters.maxTotal);

  if (filters.createdFrom)
    query = query.gte("created_at", filters.createdFrom.toISOString());

  if (filters.createdTo)
    query = query.lte("created_at", filters.createdTo.toISOString());

  // ---------------------------------------------
  // 6. EXECUTE BASE QUERY
  // ---------------------------------------------
  const {
    data: rows,
    error,
    count,
  } = await query.order(sortField, { ascending }).range(from, to);

  if (error) {
    logger.error("User orders fetch failed", {
      userId,
      error: error.message,
    });
    return next(new AppError("Failed to fetch your orders", 500));
  }

  // ---------------------------------------------
  // 7. SEARCH FILTER: PRODUCT NAME
  // ---------------------------------------------
  let filteredOrders = rows;

  if (filters.q) {
    const search = filters.q.toLowerCase();

    filteredOrders = rows.filter((ord) =>
      ord.items?.some((item) => item.name?.toLowerCase().includes(search))
    );
  }

  // ---------------------------------------------
  // 8. RESPONSE
  // ---------------------------------------------
  res.status(200).json({
    success: true,
    page,
    limit,
    total: count ?? filteredOrders.length,
    results: filteredOrders.length,
    data: filteredOrders,
  });

  logger.info("User orders fetched successfully", {
    userId,
    results: filteredOrders.length,
  });
});

/**
 * GET /api/orders/:id/payment-status
 * Returns simple payment status for polling
 */
export const getPaymentStatus = asyncHandler(async (req, res, next) => {
  const orderId = req.params.id;

  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id, is_paid, status, paid_at")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    logger.error("Get payment status failed", {
      error: error.message,
      orderId,
    });
    return next(new AppError("Failed to fetch payment status", 500));
  }

  validateOrderOwnership(order, req.user.id, req.user.role);

  res.status(200).json({
    success: true,
    data: {
      isPaid: order.is_paid,
      status: order.status,
      paidAt: order.paid_at,
    },
  });
});

/**
 * PUT /api/orders/:id/cancel
 * Allows user to cancel a pending, unpaid order
 */
export const cancelOrder = asyncHandler(async (req, res, next) => {
  const orderId = req.params.id;

  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      items:order_items (
        id,
        product_id,
        quantity
      )
    `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    logger.error("Cancel order fetch failed", {
      error: error.message,
      orderId,
    });
    return next(new AppError("Failed to fetch order", 500));
  }

  validateOrderOwnership(order, req.user.id, req.user.role);

  if (order.is_paid) {
    throw new AppError("Cannot cancel a paid order", 400);
  }

  if (order.status !== "pending") {
    throw new AppError("Only pending orders can be cancelled", 400);
  }

  // Mark as cancelled
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateError) {
    logger.error("Cancel order update failed", {
      error: updateError.message,
      orderId,
    });
    return next(new AppError("Failed to cancel order", 500));
  }

  // Optionally restock products
  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      try {
        await changeStock(item.product_id, item.quantity);
      } catch (err) {
        logger.error("Restock after cancel failed", {
          error: err.message,
          orderId,
          productId: item.product_id,
        });
      }
    }
  }

  res.status(200).json({
    success: true,
    message: "Order cancelled",
  });
});

/**
 * PUT /api/orders/:id/return
 * Allows user to request a return within window
 */
export const requestReturn = asyncHandler(async (req, res, next) => {
  const orderId = req.params.id;

  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    logger.error("Request return fetch failed", {
      error: error.message,
      orderId,
    });
    return next(new AppError("Failed to fetch order", 500));
  }

  validateOrderOwnership(order, req.user.id, req.user.role);

  if (!order.is_delivered) {
    throw new AppError("Cannot request return for undelivered order", 400);
  }

  const deliveredAt =
    order.delivered_at || order.updated_at || order.created_at;
  const now = new Date();
  const diffDays = (now - new Date(deliveredAt)) / (1000 * 60 * 60 * 24);

  if (diffDays > ORDER_CONFIG.RETURN_WINDOW_DAYS) {
    throw new AppError("Return window has expired", 400);
  }

  if (order.return_status !== "none") {
    throw new AppError("Return has already been requested for this order", 400);
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({
      return_status: "requested",
      return_requested_at: now.toISOString(),
    })
    .eq("id", orderId)
    .select("*")
    .single();

  if (updateError) {
    logger.error("Request return update failed", {
      error: updateError.message,
      orderId,
    });
    return next(new AppError("Failed to request return", 500));
  }

  res.status(200).json({
    success: true,
    message: "Return requested",
    data: updatedOrder,
  });
});
