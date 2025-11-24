// server/routes/reviewRoutes.js
import express from "express";
import {
  updateReviewController,
  deleteReviewController,
  getProductReviews,
} from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route - get product reviews
router.get("/products/:id/reviews", getProductReviews);

// Protected routes - user can update/delete their own reviews
router.use(protect);
router.patch("/:reviewId", updateReviewController);
router.delete("/:reviewId", deleteReviewController);

export default router;
