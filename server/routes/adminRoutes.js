// File: server/routes/adminRoutes.js

import express from "express";
import {
  // Analytics & Dashboard
  getSalesAnalytics,
  getProductStats,
  getDashboardOverview,
  getInventoryAnalytics,
  getUserAnalytics,
  getOrderAnalytics,

  // User Management
  createUser,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUser,

  // Product Management
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductReviews,
  deleteProductReview,
  toggleProductActive,
  toggleProductFeature,
  updateProductStock,

  // Order Management
  getOrders,
  updateOrderToDelivered,
  processRefund,
  processReturn,
  approveReturn,
  markOrderAsPaid,
  updateOrderStatus,

  // Coupon Management
  createCoupon,
  getCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCoupon,

  // Review Management
  getAllReviews,
  moderateReview,
} from "../controllers/adminController.js";

import {
  protect,
  verifiedEmail,
  twoFactorAuth,
  restrictTo,
} from "../middleware/authMiddleware.js";

import {
  getAllLogs,
  getLogById,
  getAvailableLogDates,
  getLogStats,
} from "../controllers/logController.js";
import { getOrderById } from "../controllers/orderController.js";

// Rate limiters (centralized config)
import { adminLimiter, logRateLimiter } from "../config/rateLimit.js";

import upload from "../middleware/upload.js";

const router = express.Router();

/* ============================================================================
   SECURITY & ACCESS CONTROL
   ========================================================================== */
router.use(protect);
router.use(verifiedEmail);
router.use(twoFactorAuth);
router.use(restrictTo("admin"));

// Apply global admin-level rate limiting
router.use(adminLimiter);

/* ============================================================================
   ANALYTICS & DASHBOARD ROUTES
   ========================================================================== */
router.get("/analytics/overview", getDashboardOverview);
router.get("/analytics/sales", getSalesAnalytics);
router.get("/analytics/users", getUserAnalytics);
router.get("/analytics/orders", getOrderAnalytics);
router.get("/analytics/products", getProductStats);
router.get("/analytics/inventory", getInventoryAnalytics);

/* ============================================================================
   USER MANAGEMENT ROUTES
   ========================================================================== */
router.post("/users", createUser);
router.get("/users", getAllUsers);

router
  .route("/users/:id")
  .get(getUserById)
  .patch(updateUser)
  .delete(deleteUser);

/* ============================================================================
   PRODUCT MANAGEMENT ROUTES
   ========================================================================== */
router.get("/products", getAllProducts);
router.post("/products", upload.array("images", 10), createProduct);

router
  .route("/products/:id")
  .patch(upload.array("images", 10), updateProduct)
  .delete(deleteProduct);

router.patch("/products/:id/toggle-active", toggleProductActive);
router.patch("/products/:id/feature", toggleProductFeature);
router.patch("/products/:id/stock", updateProductStock);

router
  .route("/products/:id/reviews")
  .get(getProductReviews)
  .delete(deleteProductReview);

/* ============================================================================
   ORDER MANAGEMENT ROUTES
   ========================================================================== */
router.get("/orders", getOrders);
router.get("/orders/:id", getOrderById);
router.patch("/orders/:id/update-status", updateOrderStatus);
router.patch("/orders/:id/mark-paid", markOrderAsPaid);
router.patch("/orders/:id/mark-delivered", updateOrderToDelivered);
router.patch("/orders/:id/refund", processRefund);
router.patch("/orders/:id/approve-return", approveReturn);
router.post("/orders/:id/refund", processRefund);
router.put("/orders/:id/process-return", processReturn);

/* ============================================================================
   COUPON MANAGEMENT ROUTES
   ========================================================================== */
router.route("/coupons").post(createCoupon).get(getCoupons);

router
  .route("/coupons/:id")
  .get(getCoupon)
  .patch(updateCoupon)
  .delete(deleteCoupon);

router.patch("/coupons/:id/toggle", toggleCoupon);

/* ============================================================================
   REVIEW MANAGEMENT ROUTES
   ========================================================================== */
router.get("/reviews", getAllReviews);
router.patch("/reviews/:id/moderate", moderateReview);
router.delete("/reviews/:id", deleteProductReview);

/* ============================================================================
   SYSTEM & LOG MANAGEMENT ROUTES (with logRateLimiter)
   ========================================================================== */
router.use("/logs", logRateLimiter); // Apply ONLY to /logs routes

router.get("/logs", getAllLogs);
router.get("/logs/:id", getLogById);
router.get("/logs/dates/available", getAvailableLogDates);
router.get("/logs/stats", getLogStats);
router.get("/logs/errors", (req, res, next) => {
  req.query.level = "error";
  return getAllLogs(req, res, next);
});
router.get("/logs/access", (req, res, next) => {
  req.query.type = "request";
  return getAllLogs(req, res, next);
});

export default router;
