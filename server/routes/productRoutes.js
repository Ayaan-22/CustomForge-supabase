// File: server/routes/productRoutes.js
// Mount: /api/v1/products
//
// PUBLIC (no auth): catalog reads + product-scoped review listing.
// PROTECTED: wishlist + create review (user identity required).
import express from "express";
import {
  getAllProducts,
  getProduct,
  getTopProducts,
  getRelatedProducts,
  searchProducts,
  getCategories,
  getBrands,
  getCatalogFacets,
  getFeaturedProducts,
  getProductsByCategory,
  createProductReview,
  addToWishlist,
  removeFromWishlist,
} from "../controllers/productController.js";
import { getProductReviews } from "../controllers/reviewController.js";

import { protect, restrictTo, verifiedEmail } from "../middleware/authMiddleware.js";
import { deprecatedRoute } from "../middleware/deprecatedRoute.js";
import { userActionLimiter } from "../config/rateLimit.js";

const router = express.Router();

/* --------------------------------------------------------------------------
   PUBLIC — register static and multi-segment paths before `/:id`
   -------------------------------------------------------------------------- */
router.get("/", getAllProducts);
router.get("/top", getTopProducts);
router.get("/search", searchProducts);
router.get("/categories", getCategories);
router.get("/brands", getBrands);
router.get("/facets", getCatalogFacets);
router.get("/featured", getFeaturedProducts);
router.get("/category/:category", getProductsByCategory);

/** Storefront + client use GET /api/v1/products/:id/reviews (public). */
router.get("/:id/reviews", getProductReviews);

router.get("/:id/related", getRelatedProducts);
router.get("/:id", getProduct);

/* --------------------------------------------------------------------------
   PROTECTED — wishlist + submit review
   -------------------------------------------------------------------------- */
router.post(
  "/:id/wishlist",
  userActionLimiter,
  deprecatedRoute((req) => `/api/v1/users/wishlist/${encodeURIComponent(req.params.id)}`),
  protect,
  verifiedEmail,
  restrictTo("user", "admin"),
  addToWishlist
);
router.delete(
  "/:id/wishlist",
  userActionLimiter,
  deprecatedRoute((req) => `/api/v1/users/wishlist/${encodeURIComponent(req.params.id)}`),
  protect,
  verifiedEmail,
  restrictTo("user", "admin"),
  removeFromWishlist
);
router.post(
  "/:id/reviews",
  userActionLimiter,
  protect,
  verifiedEmail,
  restrictTo("user", "admin"),
  createProductReview
);

export default router;
