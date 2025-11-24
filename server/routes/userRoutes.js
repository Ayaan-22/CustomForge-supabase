// server/routes/userRoutes.js

import express from "express";
import {
  getMe,
  updateMe,
  deleteMe,
  getWishlistController,
  getUserOrders,
  changePassword,
  addToWishlist,
  removeFromWishlist,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  setDefaultAddress,
  deleteUserAddress,
  getUserPaymentMethods,
  addUserPaymentMethod,
  updateUserPaymentMethod,
  setDefaultPaymentMethod,
  deleteUserPaymentMethod,
} from "../controllers/userController.js";

import {
  protect,
  verifiedEmail,
  twoFactorAuth,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/* ============================
   ALL ROUTES REQUIRE LOGIN + VERIFIED EMAIL
   ============================ */
router.use(protect);
router.use(verifiedEmail);

/* ============================
   ACCOUNT MANAGEMENT
   ============================ */

// GET profile (no 2FA needed for viewing)
router.get("/profile", getMe);
router.get("/me", getMe); // Alias for compatibility

// Update profile (PROTECTED by 2FA)
router.patch("/profile", twoFactorAuth, updateMe);
router.patch("/update-me", twoFactorAuth, updateMe); // Alias

// Change password
router.patch("/change-password", twoFactorAuth, changePassword);

// Deactivate account (HIGH-RISK → require 2FA)
router.delete("/delete-account", twoFactorAuth, deleteMe);
router.delete("/delete-me", twoFactorAuth, deleteMe); // Alias

/* ============================
   WISHLIST
   ============================ */
router.get("/wishlist", getWishlistController);
router.post("/wishlist/:productId", addToWishlist);
router.delete("/wishlist/:productId", removeFromWishlist);

/* ============================
   ORDERS
   ============================ */
router.get("/orders", getUserOrders);
router.get("/my-orders", getUserOrders); // Alias

/* ============================
   ADDRESSES
   ============================ */
router.get("/addresses", getUserAddresses);
router.post("/addresses", addUserAddress);
router.patch("/addresses/:id", updateUserAddress);
router.patch("/addresses/:id/default", setDefaultAddress);
router.delete("/addresses/:id", deleteUserAddress);

/* ============================
   PAYMENT METHODS
   ============================ */
router.get("/payment-methods", getUserPaymentMethods);
router.post("/payment-methods", addUserPaymentMethod);
router.patch("/payment-methods/:id", updateUserPaymentMethod);
router.patch("/payment-methods/:id/default", setDefaultPaymentMethod);
router.delete("/payment-methods/:id", deleteUserPaymentMethod);

export default router;
