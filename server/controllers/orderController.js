// server/controllers/orderController.js
import asyncHandler from "express-async-handler";
import AppError from "../utils/appError.js";
import { logger } from "../middleware/logger.js";
import { getSupabaseClient } from "../config/db.js";
import Email from "../utils/email.js";

import { mapOrderToFrontend } from "../utils/orderTransform.js";

const ORDER_CONFIG = { RETURN_WINDOW_DAYS: 30 };
const isValidUUID = (value) =>
  typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);

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

/** Create the complete order in one owner-scoped database transaction. */
export const createOrder = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  const { shippingAddress, shippingAddressId, paymentMethod = "stripe", idempotencyKey } = req.body;
  if (paymentMethod === "paypal") return next(new AppError("PayPal checkout is unavailable", 503));
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 255) return next(new AppError('A stable checkout idempotency key is required',400));
  const { data, error } = await supabase.rpc("checkout_cart", {
    p_shipping_address_id: shippingAddressId || null,
    p_shipping_address: shippingAddress || null,
    p_payment_method: paymentMethod,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    logger.error("Atomic checkout failed", { userId: req.user.id, code: error.code, error: error.message });
    const status = { "22023": 400, "42501": 403, P0001: 409, "23505": 409 }[error.code];
    if (status) return next(new AppError(
      error.code === "23505" ? "Checkout conflict. Please use a new checkout attempt." : error.message, status
    ));
    return next(new AppError("Failed to create order", 500));
  }
  if (!data?.order?.id) return next(new AppError("Failed to create order", 500));
  const { order, reused } = data;
  // A replay must not resend email. The transaction has committed before this runs.
  if (!reused) setImmediate(async () => {
    try {
      await new Email(req.user, `${process.env.CLIENT_URL || process.env.FRONTEND_URL}/orders/${order.id}`).sendOrderConfirmation(order);
    } catch (err) {
      logger.error("Order confirmation email failed", { orderId: order.id, error: err.message });
    }
  });
  res.status(reused ? 200 : 201).json({
    success: true,
    ...(reused ? { idempotent: true } : {}),
    data: mapOrderToFrontend(order),
    message: reused ? "Order already created" : "Order created successfully",
  });
});

/**
 * GET /api/orders/:id
 * Get order by ID (user or admin)
 */
export const getOrderById = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  const orderId = req.params.id;

  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  let orderQuery = supabase.from("orders").select(
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
    );

  orderQuery = orderQuery.eq("id", orderId);
  if (req.user.role !== "admin") {
    orderQuery = orderQuery.eq("user_id", req.user.id);
  }

  const { data: order, error } = await orderQuery.maybeSingle();

  if (error) {
    logger.error("Get order by ID failed", {
      error: error.message,
      orderId,
    });
    return next(new AppError("Failed to fetch order", 500));
  }

  validateOrderOwnership(order, req.user.id, req.user.role);

  const transformedOrder = mapOrderToFrontend(order);

  res.status(200).json({
    success: true,
    data: transformedOrder,
  });
});

/**
 * GET /api/orders/my
 * Get USER orders with advanced filtering + sorting + pagination
 */
export const getMyOrders = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
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
      payment_method,
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
  // 8. TRANSFORM AND RESPONSE
  // ---------------------------------------------
  const transformedOrders = filteredOrders.map(mapOrderToFrontend);

  res.status(200).json({
    success: true,
    page,
    limit,
    total: count ?? filteredOrders.length,
    results: filteredOrders.length,
    data: transformedOrders,
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
  const supabase = getSupabaseClient(req);
  const orderId = req.params.id;

  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  let paymentStatusQuery = supabase
    .from("orders")
    .select("id, user_id, is_paid, status, paid_at")
    .eq("id", orderId);

  if (req.user.role !== "admin") {
    paymentStatusQuery = paymentStatusQuery.eq("user_id", req.user.id);
  }

  const { data: order, error } = await paymentStatusQuery.maybeSingle();

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
export const cancelOrder = asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) throw new AppError("Invalid order ID", 400);
  const {data, error} = await getSupabaseClient(req).rpc('cancel_unpaid_order', {p_order_id:req.params.id});
  if (error) {
    const status = error.code === '42501' ? 404 : error.code === 'P0001' ? 409 : 503;
    throw new AppError(status === 404 ? 'Order not found' : status === 409 ? 'This order cannot be cancelled automatically. Contact support for payment reconciliation.' : 'Cancellation is unavailable. Please retry later.', status);
  }
  if (!data) throw new AppError('Cancellation could not be confirmed',503);
  res.json({success:true, message:'Order cancelled',data});
});

/**
 * PUT /api/orders/:id/return
 * Allows user to request a return within window
 */
export const requestReturn = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  const orderId = req.params.id;

  if (!isValidUUID(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  let returnQuery = supabase.from("orders").select("*").eq("id", orderId);
  if (req.user.role !== "admin") {
    returnQuery = returnQuery.eq("user_id", req.user.id);
  }

  const { data: order, error } = await returnQuery.maybeSingle();

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
      updated_at:now.toISOString(),
    })
    .eq("id", orderId).eq("return_status","none").eq("updated_at",order.updated_at)
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
    data: mapOrderToFrontend(updatedOrder),
  });
});
