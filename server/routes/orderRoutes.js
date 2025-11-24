// File: server/routes/orderRoutes.js
import express from "express";
import {
  createOrder,
  getOrderById,
  getMyOrders,
  getPaymentStatus,
  cancelOrder,
  requestReturn,
} from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All order routes require authentication
router.use(protect);

/**
 * ORDER CREATION (STRICT COUPON VALIDATION)
 * POST /api/orders → convert cart → order (strict validation here)
 * GET  /api/orders → get user's order history
 */
router.route("/").post(createOrder).get(getMyOrders);

/**
 * ORDER DETAILS
 * GET /api/orders/:id → fetch specific order
 */
router.route("/:id").get(getOrderById);

/**
 * PAYMENT STATUS POLLING
 * GET /api/orders/:id/payment-status
 */
router.route("/:id/payment-status").get(getPaymentStatus);

/**
 * ORDER CANCELLATION
 * POST /api/orders/cancel/:id
 */
router.post("/cancel/:id", cancelOrder);

/**
 * RETURN REQUEST
 * POST /api/orders/request-return/:id
 */
router.post("/request-return/:id", requestReturn);

export default router;
