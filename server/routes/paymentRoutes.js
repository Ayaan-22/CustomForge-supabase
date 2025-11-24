// File: server/routes/paymentRoutes.js
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
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All payment routes require authentication
router.use(protect);

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
