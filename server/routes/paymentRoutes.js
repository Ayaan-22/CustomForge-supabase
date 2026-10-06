// File: server/routes/paymentRoutes.js
// Mount: /api/v1/payment — all routes here require auth (Stripe webhook is on app in server.js).
import express from "express";
import {
  processPayment,
  createPaymentIntent,
  getPaymentMethods,
  savePaymentMethod,
  createStripeSession,
  createOrderCod,
  createPayPalOrder,
  capturePayPalOrder,
} from "../controllers/paymentController.js";
import { protect, verifiedEmail } from "../middleware/authMiddleware.js";

const router = express.Router();

// Authenticated payment APIs (Stripe webhook is mounted on app.js, not this router).
router.use(protect);
router.use(verifiedEmail);

/**
 * PROCESS PAYMENT (STRIPE / PAYPAL / COD)
 */
router.route("/process").post(processPayment);

/**
 * STRIPE CLIENT-SECRET FLOW
 */
router.route("/create-intent").post(createPaymentIntent);

/**
 * STRIPE CHECKOUT SESSION
 */
router.route("/create-stripe-session").post(createStripeSession);

/**
 * COD ORDER
 */
router.route("/create-order-cod").post(createOrderCod);

/**
 * PAYPAL ORDER FLOW
 */
router.route("/paypal/create-order").post(createPayPalOrder);

router.route("/paypal/capture-order").post(capturePayPalOrder);

/**
 * USER PAYMENT METHODS (STRIPE STORED CARDS)
 */
router.route("/payment-methods").get(getPaymentMethods).post(savePaymentMethod);

export default router;
