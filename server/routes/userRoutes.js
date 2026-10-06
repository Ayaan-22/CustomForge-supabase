// server/routes/userRoutes.js
// Mount: /api/v1/users
// PUBLIC: GET /me (optionalAuth). All others: protect + verifiedEmail; account changes add 2FA.

import express from "express";
import { deprecatedRoute } from "../middleware/deprecatedRoute.js";
import { validate } from "../middleware/validate.js";
import { addressSchema, updateAddressSchema } from "../validation/addressSchemas.js";
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
  optionalAuth,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/* ============================
   SESSION (public — no login required)
   ============================ */
router.get("/me", optionalAuth, getMe);

/* ============================
   ALL ROUTES BELOW REQUIRE LOGIN + VERIFIED EMAIL
   ============================ */
router.use(protect);
router.use(verifiedEmail);

/* ============================
   ACCOUNT MANAGEMENT
   ============================ */

// GET profile (no 2FA needed for viewing)
router.get("/profile", getMe);

// Update profile (PROTECTED by 2FA)
router.patch("/profile", twoFactorAuth, updateMe);
router.patch("/update-me", deprecatedRoute("/api/v1/users/profile"), twoFactorAuth, updateMe);

// Change password
router.patch("/change-password", deprecatedRoute("/api/v1/auth/update-password"), twoFactorAuth, changePassword);

// Deactivate account (HIGH-RISK → require 2FA)
router.delete("/delete-account", twoFactorAuth, deleteMe);
router.delete("/delete-me", deprecatedRoute("/api/v1/users/delete-account"), twoFactorAuth, deleteMe);

/* ============================
   WISHLIST
   ============================ */
router.get("/wishlist", getWishlistController);
router.post("/wishlist/:productId", addToWishlist);
router.delete("/wishlist/:productId", removeFromWishlist);

/* ============================
   ORDERS
   ============================ */
router.get("/orders", deprecatedRoute("/api/v1/orders"), getUserOrders);
router.get("/my-orders", deprecatedRoute("/api/v1/orders"), getUserOrders);

/* ============================
   ADDRESSES
   ============================ */
router.get("/addresses", getUserAddresses);
router.post("/addresses", validate(addressSchema), addUserAddress);
router.patch("/addresses/:id", validate(updateAddressSchema), updateUserAddress);
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
