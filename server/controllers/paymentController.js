// server/controllers/paymentController.js
import asyncHandler from "express-async-handler";
import Stripe from "stripe";
import { supabase } from "../config/db.js";
import { logger } from "../middleware/logger.js";
import AppError from "../utils/appError.js";
import { changeStock } from "../models/Product.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Payment configuration
const PAYMENT_CONFIG = {
  CURRENCY: "usd",
  WEBHOOK_TOLERANCE: 300, // 5 minutes for timestamp validation
  MAX_PAYMENT_AMOUNT: 1000000, // $10,000 max
  PAYMENT_INTENT_MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
};

// Stripe webhook IPs for validation (update from Stripe documentation)
const STRIPE_WEBHOOK_IPS = [
  "3.18.12.63",
  "3.130.192.231",
  "13.235.14.237",
  "13.235.122.149",
  "18.211.135.69",
  "35.154.171.200",
  "52.15.183.38",
  "54.187.174.169",
  "54.187.205.235",
  "54.187.216.72",
];

/* ----------------------- Helper Functions ----------------------- */

const isValidUUID = (value) =>
  typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);

/**
 * Sanitize metadata for Stripe
 */
function sanitizeMetadata(obj) {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value !== null && value !== undefined) {
      sanitized[key] = String(value)
        .replace(/[^\w\s@.-]/g, "")
        .trim()
        .slice(0, 500);
    }
  }
  return sanitized;
}

/**
 * Validate order ownership
 */
function validatePaymentAuthorization(order, userId, userRole) {
  const orderUserId = String(order.user_id);
  const requestUserId = String(userId);

  if (orderUserId !== requestUserId && userRole !== "admin") {
    throw new AppError(
      "Not authorized to process payment for this order",
      403
    );
  }
}

/**
 * Validate payment amount matches order
 */
function validatePaymentAmount(paidAmount, orderTotal, tolerance = 0.01) {
  const difference = Math.abs(paidAmount - orderTotal);
  if (difference > tolerance) {
    throw new AppError(
      `Payment amount (${paidAmount}) does not match order total (${orderTotal})`,
      400
    );
  }
}

/**
 * Validate webhook IP address
 */
function isValidWebhookIP(ip) {
  if (process.env.NODE_ENV !== "production") {
    return true; // Skip in development
  }

  // Remove IPv6 prefix if present
  const cleanIP = (ip || "").replace(/^::ffff:/, "");
  return STRIPE_WEBHOOK_IPS.includes(cleanIP);
}

/* ----------------------- Core Stripe Processors ----------------------- */

/**
 * Stripe Payment Processor with enhanced verification
 */
async function processStripePayment(order, paymentData, user) {
  if (!paymentData || !paymentData.paymentIntentId) {
    throw new AppError("Stripe payment intent ID is required", 400);
  }

  try {
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentData.paymentIntentId
    );

    // Verify payment intent status
    if (paymentIntent.status !== "succeeded") {
      throw new AppError(
        `Payment not completed. Status: ${paymentIntent.status}`,
        400
      );
    }

    // Verify payment intent belongs to this order
    if (
      !paymentIntent.metadata ||
      paymentIntent.metadata.orderId !== String(order.id)
    ) {
      throw new AppError("Payment intent does not match this order", 400);
    }

    // Verify customer matches (if stored)
    const customerMetadata = paymentIntent.metadata.userId;
    if (customerMetadata && customerMetadata !== String(user.id)) {
      throw new AppError("Payment intent customer mismatch", 400);
    }

    // Verify payment amount
    const paidAmount = paymentIntent.amount_received / 100;
    validatePaymentAmount(paidAmount, Number(order.total_price));

    // Verify payment is recent (prevent old payment reuse)
    const paymentCreatedAt = new Date(paymentIntent.created * 1000);
    const timeDiff = Date.now() - paymentCreatedAt.getTime();

    if (timeDiff > PAYMENT_CONFIG.PAYMENT_INTENT_MAX_AGE_MS) {
      logger.warn("Old payment intent used", {
        paymentIntentId: paymentIntent.id,
        createdAt: paymentCreatedAt,
        orderId: order.id,
        ageDays: timeDiff / (24 * 60 * 60 * 1000),
      });
    }

    return {
      id: paymentIntent.id,
      status: "succeeded",
      update_time: new Date().toISOString(),
      email_address: paymentIntent.receipt_email || user.email || null,
      payment_method: "stripe",
      transaction_id: paymentIntent.id,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    logger.error("Stripe payment processing error", {
      error: error.message,
      orderId: order.id,
    });
    throw new AppError(`Stripe payment failed: ${error.message}`, 400);
  }
}

/**
 * PayPal Payment Processor with validation
 */
async function processPayPalPayment(order, paymentData) {
  if (!paymentData || !paymentData.id) {
    throw new AppError("PayPal payment ID is required", 400);
  }

  if (!paymentData.status || paymentData.status !== "COMPLETED") {
    throw new AppError("PayPal payment not completed", 400);
  }

  if (!paymentData.payer || !paymentData.payer.email_address) {
    throw new AppError("PayPal payment data incomplete", 400);
  }

  // In production, verify this payment with PayPal API

  return {
    id: paymentData.id,
    status: "succeeded",
    update_time: paymentData.update_time || new Date().toISOString(),
    email_address: paymentData.payer.email_address,
    payment_method: "paypal",
    transaction_id: paymentData.id,
  };
}

/**
 * Cash on Delivery Processor
 */
async function processCODPayment(order) {
  // COD orders are "pending payment" until delivery.
  return {
    id: `COD_${order.id}`,
    status: "pending",
    update_time: new Date().toISOString(),
    email_address: null,
    payment_method: "cod",
  };
}

/* ----------------------- Controllers ----------------------- */

/**
 * @desc    Process payment for an order
 * @route   POST /api/payment/process
 * @access  Private
 * @body    { orderId, paymentMethod, paymentData }
 */
export const processPayment = asyncHandler(async (req, res, next) => {
  const { orderId, paymentMethod, paymentData } = req.body;

  logger.info("Process payment request", {
    orderId,
    paymentMethod,
    userId: req.user.id,
  });

  // Validate inputs
  if (!orderId || !isValidUUID(orderId)) {
    throw new AppError("Valid order ID is required", 400);
  }

  if (!paymentMethod || !["stripe", "paypal", "cod"].includes(paymentMethod)) {
    throw new AppError("Valid payment method is required", 400);
  }

  try {
    // Validate order exists and belongs to user
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      logger.error("Order lookup failed during payment", {
        error: orderError.message,
        orderId,
      });
      throw new AppError("Failed to fetch order", 500);
    }

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    validatePaymentAuthorization(order, req.user.id, req.user.role);

    if (order.is_paid) {
      throw new AppError("Order is already paid", 400);
    }

    if (order.status === "cancelled" || order.status === "refunded") {
      throw new AppError(
        "Cannot pay for cancelled or refunded order",
        400
      );
    }

    // Process payment based on method
    let paymentResult;
    const paymentUser = {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
    };

    switch (paymentMethod) {
      case "stripe":
        paymentResult = await processStripePayment(
          order,
          paymentData,
          paymentUser
        );
        break;
      case "paypal":
        paymentResult = await processPayPalPayment(order, paymentData);
        break;
      case "cod":
        paymentResult = await processCODPayment(order);
        break;
      default:
        throw new AppError("Invalid payment method", 400);
    }

    // Mark order as paid (or pending if COD)
    const nowIso = new Date().toISOString();
    const isPaid = paymentResult.status === "succeeded";
    const status =
      paymentMethod === "cod"
        ? "processing"
        : isPaid
        ? "paid"
        : order.status;

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        payment_method: paymentResult.payment_method,
        payment_result: paymentResult,
        is_paid: isPaid,
        paid_at: isPaid ? nowIso : order.paid_at,
        status,
        updated_at: nowIso,
      })
      .eq("id", order.id)
      .select("*")
      .single();

    if (updateError) {
      logger.error("Order update after payment failed", {
        error: updateError.message,
        orderId: order.id,
      });
      throw new AppError("Failed to update order after payment", 500);
    }

    logger.info("Payment processed successfully", {
      orderId: updatedOrder.id,
      paymentMethod,
      userId: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: "Payment processed successfully",
      data: updatedOrder,
    });
  } catch (error) {
    logger.error("Payment processing failed", {
      orderId,
      error: error.message,
      userId: req.user.id,
    });
    if (error instanceof AppError) throw error;
    throw new AppError("Payment processing failed", 500);
  }
});

/**
 * @desc    Create Stripe Payment Intent
 * @route   POST /api/payment/create-intent
 * @access  Private
 * @body    { orderId }
 */
export const createPaymentIntent = asyncHandler(
  async (req, res, next) => {
    const { orderId } = req.body;

    if (!orderId || !isValidUUID(orderId)) {
      throw new AppError("Valid order ID is required", 400);
    }

    // Load order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      logger.error("Order lookup failed in createPaymentIntent", {
        error: orderError.message,
        orderId,
      });
      throw new AppError("Failed to fetch order", 500);
    }

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Authorization check
    validatePaymentAuthorization(order, req.user.id, req.user.role);

    if (order.is_paid) {
      throw new AppError("Order is already paid", 400);
    }

    if (order.status === "cancelled" || order.status === "refunded") {
      throw new AppError(
        "Cannot create payment for cancelled or refunded order",
        400
      );
    }

    // Validate order amount
    const total = Number(order.total_price);
    if (total <= 0 || total > PAYMENT_CONFIG.MAX_PAYMENT_AMOUNT) {
      throw new AppError("Invalid order amount", 400);
    }

    try {
      // Fetch user from DB to get Stripe customer id
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id, email, name, stripe_customer_id")
        .eq("id", req.user.id)
        .maybeSingle();

      if (userError || !userRow) {
        logger.error("User lookup failed in createPaymentIntent", {
          error: userError?.message,
          userId: req.user.id,
        });
        throw new AppError("Failed to load user for payment", 500);
      }

      let customerId = userRow.stripe_customer_id;

      // Create Stripe customer if needed
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userRow.email,
          name: userRow.name,
          metadata: sanitizeMetadata({
            userId: String(userRow.id),
          }),
        });
        customerId = customer.id;

        // Save customer ID to user in Supabase
        const { error: updateUserError } = await supabase
          .from("users")
          .update({ stripe_customer_id: customerId })
          .eq("id", userRow.id);

        if (updateUserError) {
          logger.error("Failed to save Stripe customer ID", {
            error: updateUserError.message,
            userId: userRow.id,
          });
        }
      }

      // Sanitize all metadata
      const metadata = sanitizeMetadata({
        orderId: String(order.id),
        orderNumber: order.order_number || "",
        userId: String(userRow.id),
        userEmail: userRow.email || "",
      });

      // Build shipping object if shipping_address present
      let shipping;
      const addr = order.shipping_address;
      if (addr) {
        shipping = {
          name: String(addr.fullName || "").slice(0, 100),
          address: {
            line1: String(addr.address || "").slice(0, 200),
            city: String(addr.city || "").slice(0, 100),
            state: String(addr.state || "").slice(0, 100),
            postal_code: String(addr.postalCode || "").slice(0, 20),
            country: String(addr.country || "US").slice(0, 2),
          },
          phone: addr.phone ? String(addr.phone).slice(0, 20) : undefined,
        };
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: PAYMENT_CONFIG.CURRENCY,
        customer: customerId,
        metadata,
        description: `Payment for Order #${order.order_number || order.id}`,
        shipping,
        receipt_email: userRow.email,
      });

      logger.info("Payment intent created", {
        orderId: order.id,
        paymentIntentId: paymentIntent.id,
        amount: total,
      });

      res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      logger.error("Payment intent creation failed", {
        orderId: order.id,
        error: error.message,
      });
      throw new AppError(
        `Failed to create payment intent: ${error.message}`,
        500
      );
    }
  }
);

/**
 * @desc    Stripe Webhook Handler with replay protection
 * @route   POST /api/payment/webhook
 * @access  Public (Stripe)
 */
export const handleWebhook = asyncHandler(async (req, res, next) => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    logger.error("Webhook signature missing");
    throw new AppError("Webhook signature required", 400);
  }

  // Validate IP address in production
  const clientIP = req.ip || req.connection?.remoteAddress || "";
  if (!isValidWebhookIP(clientIP)) {
    logger.warn("Webhook from unauthorized IP", { ip: clientIP });
    return res.status(403).json({ error: "Unauthorized IP" });
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error("Webhook signature verification failed", {
      error: err.message,
    });
    throw new AppError(`Webhook Error: ${err.message}`, 400);
  }

  // Validate event timestamp to prevent replay attacks
  const eventTimestamp = event.created;
  const currentTimestamp = Math.floor(Date.now() / 1000);

  if (currentTimestamp - eventTimestamp > PAYMENT_CONFIG.WEBHOOK_TOLERANCE) {
    logger.warn("Old webhook event ignored", {
      eventId: event.id,
      eventType: event.type,
      age: currentTimestamp - eventTimestamp,
    });
    return res.json({ received: true, ignored: true });
  }

  logger.info("Webhook event received", {
    eventId: event.id,
    eventType: event.type,
  });

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handleSuccessfulPayment(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handleFailedPayment(event.data.object);
        break;

      case "charge.refunded":
        await handleRefund(event.data.object);
        break;

      case "payment_intent.canceled":
        logger.info("Payment intent cancelled", {
          paymentIntentId: event.data.object.id,
        });
        break;

      default:
        logger.info("Unhandled webhook event type", {
          type: event.type,
          eventId: event.id,
        });
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("Webhook processing error", {
      eventId: event.id,
      eventType: event.type,
      error: err.message,
      stack: err.stack,
    });

    // Return 200 to acknowledge receipt even if processing fails
    res.json({ received: true, error: err.message });
  }
});

/**
 * Handle successful payment webhook
 */
async function handleSuccessfulPayment(paymentIntent) {
  if (
    !paymentIntent ||
    !paymentIntent.metadata ||
    !paymentIntent.metadata.orderId
  ) {
    logger.error("Invalid payment intent metadata", { paymentIntent });
    return;
  }

  const orderId = paymentIntent.metadata.orderId;

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      logger.error("Order lookup failed in webhook success handler", {
        error: error.message,
        orderId,
      });
      return;
    }

    if (!order) {
      logger.error("Order not found for successful payment", { orderId });
      return;
    }

    // Idempotency: if order already paid, skip
    if (order.is_paid) {
      logger.info("Order already marked as paid", { orderId });
      return;
    }

    // Verify payment amount
    const paidAmount = paymentIntent.amount_received / 100;
    validatePaymentAmount(paidAmount, Number(order.total_price));

    const nowIso = new Date().toISOString();

    const paymentResult = {
      id: paymentIntent.id,
      status: "succeeded",
      update_time: nowIso,
      email_address:
        paymentIntent.receipt_email ||
        paymentIntent.metadata?.userEmail ||
        null,
      payment_method: "stripe",
      transaction_id: paymentIntent.id,
    };

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        is_paid: true,
        paid_at: nowIso,
        payment_method: "stripe",
        payment_result: paymentResult,
        status:
          order.status === "pending" || order.status === "processing"
            ? "paid"
            : order.status,
        updated_at: nowIso,
      })
      .eq("id", orderId);

    if (updateError) {
      logger.error("Order update failed in webhook success handler", {
        error: updateError.message,
        orderId,
      });
      return;
    }

    logger.info("Payment webhook processed successfully", {
      orderId,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    logger.error("Payment webhook processing failed", {
      orderId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Handle failed payment webhook
 */
async function handleFailedPayment(paymentIntent) {
  logger.warn("Payment failed", {
    paymentIntentId: paymentIntent.id,
    orderId: paymentIntent.metadata?.orderId,
    error: paymentIntent.last_payment_error?.message,
  });

  // Optional: update order status or notify user
}

/**
 * Handle refund webhook
 */
async function handleRefund(refundedCharge) {
  const orderId = refundedCharge.metadata?.orderId;

  if (!orderId) {
    logger.warn("Refund webhook missing order metadata", {
      chargeId: refundedCharge.id,
    });
    return;
  }

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, payment_result")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      logger.error("Order lookup failed in refund webhook", {
        error: error.message,
        orderId,
      });
      return;
    }

    if (!order) {
      logger.error("Order not found for refund", { orderId });
      return;
    }

    // Idempotency: if already refunded, skip
    if (order.status === "refunded") {
      logger.info("Order already marked as refunded", { orderId });
      return;
    }

    const refundAmount = refundedCharge.amount_refunded / 100;

    const existingResult = order.payment_result || {};
    const updatedResult = {
      ...existingResult,
      refund: {
        refundId: refundedCharge.refund || refundedCharge.id,
        amount: refundAmount,
        reason: "Stripe refund processed",
        at: new Date().toISOString(),
      },
    };

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "refunded",
        payment_result: updatedResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      logger.error("Refund update failed in webhook handler", {
        error: updateError.message,
        orderId,
      });
      return;
    }

    logger.info("Refund webhook processed successfully", {
      orderId,
      chargeId: refundedCharge.id,
      refundAmount,
    });
  } catch (error) {
    logger.error("Refund webhook processing failed", {
      orderId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * @desc    Process actual Stripe refund
 * @route   POST /api/payment/refund
 * @access  Private (Admin only)
 * @body    { orderId, amount?, reason? }
 */
export const processRefund = asyncHandler(async (req, res, next) => {
  const { orderId, amount, reason } = req.body;

  // Only admins can process refunds
  if (req.user.role !== "admin") {
    throw new AppError("Only administrators can process refunds", 403);
  }

  if (!orderId || !isValidUUID(orderId)) {
    throw new AppError("Valid order ID is required", 400);
  }

  try {
    const { data: order, error: orderError } = await supabase
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

    if (orderError) {
      logger.error("Order lookup failed in processRefund", {
        error: orderError.message,
        orderId,
      });
      throw new AppError("Failed to fetch order", 500);
    }

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.status === "refunded") {
      throw new AppError("Order is already refunded", 400);
    }

    if (!order.is_paid) {
      throw new AppError("Cannot refund unpaid order", 400);
    }

    if (order.payment_method === "cod") {
      throw new AppError(
        "COD orders cannot be refunded through this endpoint",
        400
      );
    }

    if (!order.payment_result || !order.payment_result.id) {
      throw new AppError(
        "Payment information not found for this order",
        400
      );
    }

    const total = Number(order.total_price);

    // Determine refund amount
    const refundAmount =
      amount && amount > 0 ? Math.min(amount, total) : total;

    if (refundAmount <= 0) {
      throw new AppError("Invalid refund amount", 400);
    }

    // Process Stripe refund
    let stripeRefund;
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: order.payment_result.id,
        amount: Math.round(refundAmount * 100),
        reason: reason || "requested_by_customer",
        metadata: sanitizeMetadata({
          orderId: String(order.id),
          orderNumber: order.order_number || "",
        }),
      });
    } catch (stripeError) {
      logger.error("Stripe refund failed", {
        orderId: order.id,
        error: stripeError.message,
      });
      throw new AppError(
        `Stripe refund failed: ${stripeError.message}`,
        500
      );
    }

    // Update order as refunded and (optionally) restock items
    const existingResult = order.payment_result || {};
    const updatedResult = {
      ...existingResult,
      refund: {
        refundId: stripeRefund.id,
        amount: refundAmount,
        reason: reason || "Admin processed refund",
        userId: req.user.id,
        at: new Date().toISOString(),
      },
    };

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "refunded",
        payment_result: updatedResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) {
      logger.error("Refund update failed", {
        error: updateError.message,
        orderId: order.id,
      });
      throw new AppError("Failed to update order after refund", 500);
    }

    // Restock inventory
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        try {
          await changeStock(item.product_id, item.quantity);
        } catch (err) {
          logger.error("Restock after refund failed", {
            error: err.message,
            orderId: order.id,
            productId: item.product_id,
          });
        }
      }
    }

    logger.info("Refund processed successfully", {
      orderId: order.id,
      refundAmount,
      stripeRefundId: stripeRefund.id,
    });

    res.status(200).json({
      success: true,
      message: "Refund processed successfully",
      data: {
        orderId: order.id,
        refund: {
          id: stripeRefund.id,
          amount: refundAmount,
          status: stripeRefund.status,
        },
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || "Refund processing failed", 500);
  }
});

/**
 * @desc    Save payment method for user
 * @route   POST /api/payment/save-payment-method
 * @access  Private
 * @body    { paymentMethodId }
 */
export const savePaymentMethod = asyncHandler(
  async (req, res, next) => {
    const { paymentMethodId } = req.body;

    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      throw new AppError("Valid payment method ID is required", 400);
    }

    // Load user from DB to get Stripe customer ID & payment methods
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, email, name, stripe_customer_id, payment_methods")
      .eq("id", req.user.id)
      .maybeSingle();

    if (userError || !userRow) {
      logger.error("User lookup failed in savePaymentMethod", {
        error: userError?.message,
        userId: req.user.id,
      });
      throw new AppError("Failed to load user", 500);
    }

    if (!userRow.stripe_customer_id) {
      throw new AppError(
        "No Stripe customer associated with this account",
        400
      );
    }

    try {
      // Attach payment method to customer
      const paymentMethod = await stripe.paymentMethods.attach(
        paymentMethodId,
        {
          customer: userRow.stripe_customer_id,
        }
      );

      // Get customer details
      const customer = await stripe.customers.retrieve(
        userRow.stripe_customer_id
      );

      // Set as default if no default exists
      if (!customer.invoice_settings?.default_payment_method) {
        await stripe.customers.update(userRow.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: paymentMethod.id,
          },
        });
      }

      // Save to user record (deduplicated array)
      const current = Array.isArray(userRow.payment_methods)
        ? userRow.payment_methods
        : [];
      const updated = Array.from(
        new Set([...current, paymentMethod.id])
      );

      const { error: updateError } = await supabase
        .from("users")
        .update({ payment_methods: updated })
        .eq("id", userRow.id);

      if (updateError) {
        logger.error("Failed to save payment method in DB", {
          error: updateError.message,
          userId: userRow.id,
        });
      }

      logger.info("Payment method saved", {
        userId: userRow.id,
        paymentMethodId: paymentMethod.id,
      });

      res.status(200).json({
        success: true,
        message: "Payment method saved successfully",
        data: paymentMethod,
      });
    } catch (error) {
      logger.error("Save payment method failed", {
        userId: userRow.id,
        error: error.message,
      });
      throw new AppError(
        `Failed to save payment method: ${error.message}`,
        500
      );
    }
  }
);

/**
 * @desc    Create Stripe Checkout Session
 * @route   POST /api/payment/create-stripe-session
 * @access  Private
 */
export const createStripeSession = asyncHandler(async (req, res, next) => {
  const { orderId } = req.body;

  if (!orderId || !isValidUUID(orderId)) {
    throw new AppError("Valid order ID is required", 400);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new AppError("Order not found", 404);
  }

  validatePaymentAuthorization(order, req.user.id, req.user.role);

  if (order.is_paid) {
    throw new AppError("Order is already paid", 400);
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id, email, name, stripe_customer_id")
    .eq("id", req.user.id)
    .maybeSingle();

  let customerId = userRow?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userRow?.email,
      name: userRow?.name,
      metadata: sanitizeMetadata({ userId: String(req.user.id) }),
    });
    customerId = customer.id;

    await supabase
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", req.user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Order #${order.order_number || order.id}`,
          },
          unit_amount: Math.round(Number(order.total_price) * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.FRONTEND_URL}/orders/${order.id}?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/orders/${order.id}?canceled=true`,
    metadata: sanitizeMetadata({
      orderId: String(order.id),
      userId: String(req.user.id),
    }),
  });

  res.status(200).json({
    success: true,
    sessionId: session.id,
    url: session.url,
  });
});

/**
 * @desc    Create COD Order
 * @route   POST /api/payment/create-order-cod
 * @access  Private
 */
export const createOrderCod = asyncHandler(async (req, res, next) => {
  // This is essentially the same as createOrder but with payment_method: "cod"
  // The order creation logic is in orderController, so we just redirect
  // For now, we'll create a simple COD order marker
  const { orderId } = req.body;

  if (!orderId || !isValidUUID(orderId)) {
    throw new AppError("Valid order ID is required", 400);
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    throw new AppError("Order not found", 404);
  }

  validatePaymentAuthorization(order, req.user.id, req.user.role);

  if (order.is_paid) {
    throw new AppError("Order is already paid", 400);
  }

  // Mark as COD - payment will be collected on delivery
  const { data: updated } = await supabase
    .from("orders")
    .update({
      payment_method: "cod",
      status: "processing",
    })
    .eq("id", orderId)
    .select()
    .single();

  res.status(200).json({
    success: true,
    message: "COD order created",
    data: updated,
  });
});

/**
 * @desc    Create PayPal Order
 * @route   POST /api/payment/paypal/create-order
 * @access  Private
 */
export const createPayPalOrder = asyncHandler(async (req, res, next) => {
  const { orderId } = req.body;

  if (!orderId || !isValidUUID(orderId)) {
    throw new AppError("Valid order ID is required", 400);
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    throw new AppError("Order not found", 404);
  }

  validatePaymentAuthorization(order, req.user.id, req.user.role);

  if (order.is_paid) {
    throw new AppError("Order is already paid", 400);
  }

  // In production, this would call PayPal API to create an order
  // For now, return a mock PayPal order ID
  const paypalOrderId = `PAYPAL_${order.id}_${Date.now()}`;

  res.status(200).json({
    success: true,
    paypalOrderId,
    message: "PayPal order created. Use capture-order to complete payment.",
  });
});

/**
 * @desc    Capture PayPal Order
 * @route   POST /api/payment/paypal/capture-order
 * @access  Private
 */
export const capturePayPalOrder = asyncHandler(async (req, res, next) => {
  const { orderId, paypalOrderId } = req.body;

  if (!orderId || !isValidUUID(orderId)) {
    throw new AppError("Valid order ID is required", 400);
  }

  if (!paypalOrderId) {
    throw new AppError("PayPal order ID is required", 400);
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    throw new AppError("Order not found", 404);
  }

  validatePaymentAuthorization(order, req.user.id, req.user.role);

  if (order.is_paid) {
    throw new AppError("Order is already paid", 400);
  }

  // In production, this would call PayPal API to capture the order
  // For now, process as if payment succeeded
  const paymentResult = {
    id: paypalOrderId,
    status: "succeeded",
    update_time: new Date().toISOString(),
    email_address: req.user.email,
    payment_method: "paypal",
    transaction_id: paypalOrderId,
  };

  const { data: updated } = await supabase
    .from("orders")
    .update({
      is_paid: true,
      paid_at: new Date().toISOString(),
      payment_method: "paypal",
      payment_result: paymentResult,
      status: "paid",
    })
    .eq("id", orderId)
    .select()
    .single();

  res.status(200).json({
    success: true,
    message: "PayPal payment captured",
    data: updated,
  });
});

/**
 * @desc    Get user's saved payment methods
 * @route   GET /api/payment/payment-methods
 * @access  Private
 */
export const getPaymentMethods = asyncHandler(async (req, res) => {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, stripe_customer_id")
    .eq("id", req.user.id)
    .maybeSingle();

  if (userError || !userRow) {
    logger.error("User lookup failed in getPaymentMethods", {
      error: userError?.message,
      userId: req.user.id,
    });
    throw new AppError("Failed to load user", 500);
  }

  if (!userRow.stripe_customer_id) {
    return res.status(200).json({
      success: true,
      data: [],
    });
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: userRow.stripe_customer_id,
      type: "card",
    });

    res.status(200).json({
      success: true,
      data: paymentMethods.data,
    });
  } catch (error) {
    logger.error("Get payment methods failed", {
      userId: userRow.id,
      error: error.message,
    });
    throw new AppError("Failed to retrieve payment methods", 500);
  }
});

/**
 * @desc    Remove saved payment method
 * @route   DELETE /api/payment/payment-methods/:paymentMethodId
 * @access  Private
 */
export const removePaymentMethod = asyncHandler(async (req, res) => {
  const { paymentMethodId } = req.params;

  if (!paymentMethodId) {
    throw new AppError("Payment method ID is required", 400);
  }

  // Load user to ensure they have a Stripe customer & methods
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, stripe_customer_id, payment_methods")
    .eq("id", req.user.id)
    .maybeSingle();

  if (userError || !userRow) {
    logger.error("User lookup failed in removePaymentMethod", {
      error: userError?.message,
      userId: req.user.id,
    });
    throw new AppError("Failed to load user", 500);
  }

  try {
    if (userRow.stripe_customer_id) {
      // Detach from Stripe
      await stripe.paymentMethods.detach(paymentMethodId);
    }

    // Remove from user record
    const current = Array.isArray(userRow.payment_methods)
      ? userRow.payment_methods
      : [];
    const updated = current.filter((id) => id !== paymentMethodId);

    const { error: updateError } = await supabase
      .from("users")
      .update({ payment_methods: updated })
      .eq("id", userRow.id);

    if (updateError) {
      logger.error("Failed to update user payment methods in DB", {
        error: updateError.message,
        userId: userRow.id,
      });
      throw new AppError("Failed to remove payment method", 500);
    }

    logger.info("Payment method removed", {
      userId: userRow.id,
      paymentMethodId,
    });

    res.status(200).json({
      success: true,
      message: "Payment method removed successfully",
    });
  } catch (error) {
    logger.error("Remove payment method failed", {
      userId: userRow.id,
      error: error.message,
    });
    throw new AppError("Failed to remove payment method", 500);
  }
});
