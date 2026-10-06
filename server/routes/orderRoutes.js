// File: server/routes/orderRoutes.js
// Mount: /api/v1/orders — all routes require authentication.
import express from "express";
import {
  createOrder,
  getOrderById,
  getMyOrders,
  getPaymentStatus,
  cancelOrder,
  requestReturn,
} from "../controllers/orderController.js";
import { protect, verifiedEmail } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { createOrderSchema } from "../validation/orderSchemas.js";

const router = express.Router();

// All order routes require a logged-in, verified account.
router.use(protect);
router.use(verifiedEmail);

/**
 * Static-ish paths before `/:id` so "cancel" / "request-return" cannot be captured as ids.
 */
router.route("/").post(validate(createOrderSchema), createOrder).get(getMyOrders);
router.post("/cancel/:id", cancelOrder);
router.post("/request-return/:id", requestReturn);
router.get("/:id/payment-status", getPaymentStatus);
router.get("/:id", getOrderById);

export default router;
