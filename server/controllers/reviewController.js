// server/controllers/reviewController.js
import asyncHandler from "express-async-handler";
import AppError from "../utils/appError.js";
import { logger } from "../middleware/logger.js";
import { supabase } from "../config/db.js";
import {
  updateReview,
  softDeleteReview,
} from "../models/Review.js";
import { recalcProductRatings } from "../models/Product.js";

const isValidUUID = (value) =>
  typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);

/**
 * @desc Update review
 * @route PATCH /api/reviews/:reviewId
 * @access Private
 */
export const updateReviewController = asyncHandler(async (req, res, next) => {
  const reviewId = req.params.reviewId;

  if (!isValidUUID(reviewId)) {
    return next(new AppError("Invalid review ID", 400));
  }

  // Check ownership
  const { data: review, error: fetchError } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (fetchError) {
    return next(new AppError("Failed to fetch review", 500));
  }

  if (!review) {
    return next(new AppError("Review not found", 404));
  }

  const { rating, comment, title, media } = req.body;

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return next(new AppError("Rating must be between 1 and 5", 400));
  }

  if (title && (title.length < 5 || title.length > 100)) {
    return next(
      new AppError("Title must be between 5 and 100 characters", 400)
    );
  }

  if (comment && (comment.length < 10 || comment.length > 1000)) {
    return next(
      new AppError("Comment must be between 10 and 1000 characters", 400)
    );
  }

  const updates = {
    rating,
    title,
    comment,
    media,
  };

  Object.keys(updates).forEach(
    (key) => updates[key] === undefined && delete updates[key]
  );

  const updated = await updateReview(reviewId, updates);

  res.status(200).json({
    success: true,
    data: updated,
  });

  logger.info("Review updated", { reviewId, userId: req.user.id });
});

/**
 * @desc Delete review
 * @route DELETE /api/reviews/:reviewId
 * @access Private
 */
export const deleteReviewController = asyncHandler(async (req, res, next) => {
  const reviewId = req.params.reviewId;

  if (!isValidUUID(reviewId)) {
    return next(new AppError("Invalid review ID", 400));
  }

  // Check ownership
  const { data: review, error: fetchError } = await supabase
    .from("reviews")
    .select("id, product_id")
    .eq("id", reviewId)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (fetchError) {
    return next(new AppError("Failed to fetch review", 500));
  }

  if (!review) {
    return next(new AppError("Review not found", 404));
  }

  await softDeleteReview(reviewId);

  res.status(204).json({
    success: true,
    data: null,
  });

  logger.info("Review deleted", { reviewId, userId: req.user.id });
});

/**
 * @desc Get product reviews
 * @route GET /api/products/:id/reviews
 * @access Public
 */
export const getProductReviews = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;

  if (!isValidUUID(productId)) {
    return next(new AppError("Invalid product ID", 400));
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: reviews, error, count } = await supabase
    .from("reviews")
    .select(
      `
      *,
      user:users (
        id,
        name,
        avatar,
        is_email_verified
      )
    `,
      { count: "exact" }
    )
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return next(new AppError("Failed to fetch reviews", 500));
  }

  const mappedReviews = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    createdAt: review.created_at,
    verifiedPurchase: review.verified_purchase,
    helpfulVotes: review.helpful_votes,
    media: review.media,
    user: review.user
      ? {
          id: review.user.id,
          name: review.user.name,
          avatar: review.user.avatar,
          verified: review.user.is_email_verified,
        }
      : null,
  }));

  res.status(200).json({
    success: true,
    count: count ?? mappedReviews.length,
    page,
    results: mappedReviews.length,
    data: mappedReviews,
  });

  logger.info("Fetched product reviews", { productId, count: mappedReviews.length });
});

