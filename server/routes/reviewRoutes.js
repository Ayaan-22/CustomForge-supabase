// server/routes/reviewRoutes.js
// Mount: /api/v1/reviews
// Canonical product-review READ: GET /api/v1/products/:id/reviews (productRoutes).
// This router owns review mutations + a deprecated read alias.
import express from "express";
import {
  updateReviewController,
  deleteReviewController,
  getProductReviews,
  getOwnProductReview,
} from "../controllers/reviewController.js";
import { protect, verifiedEmail } from "../middleware/authMiddleware.js";
import { deprecatedRoute } from "../middleware/deprecatedRoute.js";

const router = express.Router();

const markDeprecatedReviewRead = deprecatedRoute(
  (req) => `/api/v1/products/${encodeURIComponent(req.params.id)}/reviews`
);

/**
 * @deprecated Use GET /api/v1/products/:id/reviews
 * Kept so older clients keep working. Do not add new callers.
 */
router.get(
  "/products/:id/reviews",
  markDeprecatedReviewRead,
  getProductReviews
);

router.use(protect);
router.use(verifiedEmail);
router.get("/products/:id/mine", getOwnProductReview);
router.patch("/:reviewId", updateReviewController);
router.delete("/:reviewId", deleteReviewController);

export default router;
