// server/controllers/paymentController.js
import asyncHandler from "express-async-handler";
import Stripe from "stripe";
import { getServiceClient, getSupabaseClient } from "../config/db.js";
import { logger } from "../middleware/logger.js";
import AppError from "../utils/appError.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const serviceSupabase = getServiceClient();

// Payment configuration
const PAYMENT_CONFIG = {
  CURRENCY: "usd",
  WEBHOOK_TOLERANCE: 300, // 5 minutes for timestamp validation
  MAX_PAYMENT_AMOUNT: 1000000, // $10,000 max
  PAYMENT_INTENT_MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
};

// Verified 2026-10-04 against https://docs.stripe.com/ips#webhook-notifications.
// Keep the deployment proxy trust configuration and this allowlist current.
const STRIPE_WEBHOOK_IPS = [
  "3.18.12.63",
  "3.130.192.231",
  "13.235.14.237",
  "13.235.122.149",
  "18.211.135.69",
  "35.154.171.200",
  "52.15.183.38",
  "54.88.130.119",
  "54.88.130.237",
  "54.187.174.169",
  "54.187.205.235",
  "54.187.216.72",
  "35.157.207.129",
  "3.69.109.8",
  "3.120.168.93",
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
function validatePaymentAuthorization(order, userId) {
  const orderUserId = String(order.user_id);
  const requestUserId = String(userId);

  if (orderUserId !== requestUserId) {
    throw new AppError("Not authorized to process payment for this order", 403);
  }
}

/**
 * Validate payment amount matches order
 */
function validatePaymentAmount(paidCents, orderTotal) {
  if (!Number.isSafeInteger(paidCents) || paidCents !== Math.round(Number(orderTotal) * 100)) {
    throw new AppError('Payment amount does not match order total', 400);
  }
}

async function verifyCustomer(customerId, userId) {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || customer.metadata?.userId !== String(userId)) {
    throw new AppError('Payment account ownership could not be verified', 409);
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
/* ----------------------- Controllers ----------------------- */

/**
 * @desc    Process payment for an order
 * @route   POST /api/payment/process
 * @access  Private
 * @body    { orderId, paymentMethod, paymentData }
 */
export const processPayment = asyncHandler(async () => {
  throw new AppError("Use the order checkout flow. Payment settlement is confirmed by the provider webhook.", 503);
});

/**
 * @desc    Create Stripe Payment Intent
 * @route   POST /api/payment/create-intent
 * @access  Private
 * @body    { orderId }
 */
export const createPaymentIntent = asyncHandler(async () => {
  throw new AppError("Direct payment intents are unavailable. Use hosted Stripe Checkout.", 503);
});

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
    throw new AppError("Invalid webhook signature", 400);
  }

  // constructEvent validates the delivery signature timestamp. The event creation
  // time may be old during a legitimate Stripe retry after an outage.
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

    // A failed delivery must remain retryable; never acknowledge lost settlement.
    throw new AppError("Payment event processing is temporarily unavailable", 503);
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
    logger.error("Invalid payment intent metadata", { paymentIntentId: paymentIntent?.id });
    return;
  }

  const orderId = paymentIntent.metadata.orderId;

  try {
    const { data: order, error } = await serviceSupabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      logger.error("Order lookup failed in webhook success handler", {
        error: error.message,
        orderId,
      });
      throw new AppError("Unable to persist payment event", 503);
    }

    if (!order) {
      throw new AppError("Payment order is unavailable", 503);
    }

    if (order.payment_method !== 'stripe' || paymentIntent.metadata.userId !== String(order.user_id)
      || !order.payment_result?.stripeCustomerId || paymentIntent.customer !== order.payment_result.stripeCustomerId) {
      throw new AppError('Payment ownership does not match order',409);
    }
    if (paymentIntent.currency !== PAYMENT_CONFIG.CURRENCY) throw new AppError('Payment currency does not match order',400);
    validatePaymentAmount(paymentIntent.amount_received, order.total_price);
    if (order.is_paid) {
      if (order.payment_result?.transaction_id !== paymentIntent.id) throw new AppError('Conflicting payment requires reconciliation',409);
      return;
    }
    if (!['pending','processing'].includes(order.status)) throw new AppError('This order cannot accept payment',409);

    const nowIso = new Date().toISOString();

    const paymentResult = {
      ...order.payment_result,
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

    const { data: written, error: updateError } = await serviceSupabase
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
      .eq("id", orderId).eq("updated_at", order.updated_at).select("id").maybeSingle();

    if (updateError || !written) {
      logger.error("Order update failed in webhook success handler", {
        error: updateError?.message || "Concurrent order change",
        orderId,
      });
      throw new AppError("Unable to persist payment event", 503);
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
  let orderId = refundedCharge.metadata?.orderId;
  if (!orderId && refundedCharge.payment_intent) {
    const intent = await stripe.paymentIntents.retrieve(refundedCharge.payment_intent);
    orderId = intent.metadata?.orderId;
  }

  if (!orderId) {
    logger.warn("Refund webhook missing order metadata", {
      chargeId: refundedCharge.id,
    });
    return;
  }

  try {
    const { data: order, error } = await serviceSupabase
      .from("orders")
      .select("id, status, is_paid, payment_method, payment_result, total_price, updated_at")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      logger.error("Order lookup failed in refund webhook", {
        error: error.message,
        orderId,
      });
      throw new AppError("Unable to persist payment event", 503);
    }

    if (!order) {
      throw new AppError("Refund order is unavailable",503);
    }

    if (!order.is_paid || order.payment_method !== 'stripe' || !order.payment_result?.transaction_id
      || refundedCharge.payment_intent !== order.payment_result.transaction_id || refundedCharge.currency !== PAYMENT_CONFIG.CURRENCY) {
      throw new AppError('Refund does not match settled payment',409);
    }
    const refundCents = refundedCharge.amount_refunded;
    const totalCents = Math.round(Number(order.total_price)*100);
    if (!Number.isSafeInteger(refundCents) || refundCents <= 0 || refundCents > totalCents) throw new AppError('Invalid refund amount',409);
    const refundAmount = refundCents / 100;
    // Stripe reports the cumulative refunded amount. Older deliveries must never regress it.
    if (refundAmount <= Number(order.payment_result?.refund?.amount || 0)) return;

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

    const { data: written, error: updateError } = await serviceSupabase
      .from("orders")
      .update({
        status: refundAmount >= Number(order.total_price) ? "refunded" : order.status,
        payment_result: updatedResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId).eq("updated_at", order.updated_at).select("id").maybeSingle();

    if (updateError || !written) {
      logger.error("Refund update failed in webhook handler", {
        error: updateError?.message || "Concurrent order change",
        orderId,
      });
      throw new AppError("Unable to persist payment event", 503);
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
export const processRefund = asyncHandler(async () => {
  throw new AppError("Refunds are unavailable until the provider ledger and inventory reconciliation are deployed.", 503);
});

/**
 * @desc    Save payment method for user
 * @route   POST /api/payment/save-payment-method
 * @access  Private
 * @body    { paymentMethodId }
 */
export const savePaymentMethod = asyncHandler(async () => {
  throw new AppError("Saved-card enrollment is unavailable until verified setup and consent are implemented.", 503);
});

/**
 * @desc    Create Stripe Checkout Session
 * @route   POST /api/payment/create-stripe-session
 * @access  Private
 */
export const createStripeSession = asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseClient(req);
  const { orderId } = req.body;

  if (!orderId || !isValidUUID(orderId)) {
    throw new AppError("Valid order ID is required", 400);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw new AppError("Unable to load order. Please retry.", 503);
  if (!order) throw new AppError("Order not found", 404);

  validatePaymentAuthorization(order, req.user.id, req.user.role);

  if (["cancelled", "refunded", "returned"].includes(order.status)) {
    throw new AppError("This order cannot accept payment", 409);
  }

  if (order.is_paid) {
    throw new AppError("Order is already paid", 400);
  }

  if (order.payment_method !== "stripe") throw new AppError("This order does not use Stripe", 409);
  const amount = Math.round(Number(order.total_price) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > PAYMENT_CONFIG.MAX_PAYMENT_AMOUNT) throw new AppError("Invalid order amount", 400);
  const origin = process.env.CLIENT_URL || process.env.FRONTEND_URL;
  let redirectOrigin;
  try { const url = new URL(origin); if (url.username || url.password || !['http:', 'https:'].includes(url.protocol) || (url.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(url.hostname))) throw new Error(); redirectOrigin = url.origin; }
  catch { throw new AppError("Payment redirects are not configured", 503); }

  const previousSession = order.payment_result?.checkoutSessionId;
  if (previousSession) {
    const existingSession = await stripe.checkout.sessions.retrieve(previousSession);
    if (existingSession.status !== 'expired') {
      if (existingSession.metadata?.orderId !== String(order.id) || existingSession.metadata?.userId !== String(req.user.id)
        || existingSession.amount_total !== amount || existingSession.currency !== PAYMENT_CONFIG.CURRENCY
        || typeof existingSession.customer !== 'string') throw new AppError('Payment session could not be verified',409);
      await verifyCustomer(existingSession.customer,req.user.id);
      if (!order.payment_result?.stripeCustomerId) {
        const {data:saved,error} = await supabase.from('orders').update({payment_result:{...order.payment_result,stripeCustomerId:existingSession.customer},updated_at:new Date().toISOString()})
          .eq('id',order.id).eq('updated_at',order.updated_at).eq('is_paid',false).select('id').maybeSingle();
        if (error || !saved) throw new AppError('Payment session could not be saved. Please retry.',503);
      } else if (order.payment_result.stripeCustomerId !== existingSession.customer) throw new AppError('Payment account conflict requires reconciliation',409);
      if (existingSession.status === 'open' && existingSession.url) return res.json({success:true,sessionId:existingSession.id,url:existingSession.url});
      throw new AppError('Payment is being confirmed. Refresh your order before retrying.',409);
    }
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, email, name, stripe_customer_id")
    .eq("id", req.user.id)
    .maybeSingle();

  if (userError || !userRow) throw new AppError("Unable to load payment account", 503);
  let customerId = userRow?.stripe_customer_id;

  if (customerId) await verifyCustomer(customerId, req.user.id);
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userRow?.email,
      name: userRow?.name,
      metadata: sanitizeMetadata({ userId: String(req.user.id) }),
    }, {idempotencyKey: `customer-${req.user.id}`});
    customerId = customer.id;

    const {error: customerError} = await supabase
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", req.user.id);
    if (customerError) throw new AppError("Unable to save payment account", 503);
  }

  const session = await stripe.checkout.sessions.create({
    payment_intent_data: {
      metadata: sanitizeMetadata({ orderId: String(order.id), userId: String(req.user.id) }),
    },
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Order #${order.order_number || order.id}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${redirectOrigin}/orders/${order.id}?success=true`,
    cancel_url: `${redirectOrigin}/orders/${order.id}?canceled=true`,
    metadata: sanitizeMetadata({
      orderId: String(order.id),
      userId: String(req.user.id),
    }),
  }, {idempotencyKey: `checkout-${order.id}-${previousSession || 'initial'}`});

  const {data: savedSession, error: sessionError} = await supabase.from("orders").update({payment_result:{...order.payment_result,checkoutSessionId:session.id,stripeCustomerId:customerId},updated_at:new Date().toISOString()}).eq("id",order.id).eq("is_paid",false).eq("status",order.status).eq("updated_at",order.updated_at).select("id").maybeSingle();
  if (sessionError || !savedSession) throw new AppError("Unable to save payment session. Please retry.", 503);
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
export const createOrderCod = asyncHandler(async () => {
  throw new AppError("Choose cash on delivery when creating the order. Existing orders cannot change payment method.", 503);
});

/**
 * @desc    Create PayPal Order
 * @route   POST /api/payment/paypal/create-order
 * @access  Private
 */
export const createPayPalOrder = asyncHandler(async () => {
  throw new AppError('PayPal payments are not available. Please choose another payment method.', 503);
});

/**
 * @desc    Capture PayPal Order
 * @route   POST /api/payment/paypal/capture-order
 * @access  Private
 */
export const capturePayPalOrder = asyncHandler(async () => {
  throw new AppError('PayPal payments are not available. Please choose another payment method.', 503);
});

/**
 * @desc    Get user's saved payment methods
 * @route   GET /api/payment/payment-methods
 * @access  Private
 */
export const getPaymentMethods = asyncHandler(async (req, res) => {
  const supabase = getSupabaseClient(req);
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
    await verifyCustomer(userRow.stripe_customer_id, req.user.id);
    const paymentMethods = await stripe.paymentMethods.list({
      customer: userRow.stripe_customer_id,
      type: "card",
      limit: 100,
    });

    res.status(200).json({
      success: true,
      data: paymentMethods.data.map(({id, type, card}) => ({id,type,card: {brand:card.brand,last4:card.last4,exp_month:card.exp_month,exp_year:card.exp_year}})),
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
export const removePaymentMethod = asyncHandler(async () => {
  throw new AppError('Saved-card changes are unavailable until the provider lifecycle is implemented.',503);
});
