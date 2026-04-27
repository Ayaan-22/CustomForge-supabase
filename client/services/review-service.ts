import { apiFetch, type ApiResponse } from "@/lib/apiClient";
import type { Review } from "@/lib/types";

export type AddReviewPayload = {
  rating: number;
  comment: string;
  title?: string;
};

export type UpdateReviewPayload = Partial<AddReviewPayload>;

export type ReviewsQuery = {
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "highest" | "lowest";
};

export const ReviewService = {
  // Get reviews for a product (public)
  getProductReviews(
    productId: string,
    query?: ReviewsQuery
  ): Promise<ApiResponse<Review[]>> {
    return apiFetch(
      `/reviews/products/${encodeURIComponent(productId)}/reviews`,
      {
        method: "GET",
        params: query as any,
      }
    );
  },

  // Add a review (authenticated, verified users only)
  addReview(
    productId: string,
    payload: AddReviewPayload
  ): Promise<ApiResponse<{ review: Review }>> {
    return apiFetch(`/products/${encodeURIComponent(productId)}/reviews`, {
      method: "POST",
      body: payload,
    });
  },

  // Update own review
  updateReview(
    reviewId: string,
    payload: UpdateReviewPayload
  ): Promise<ApiResponse<{ review: Review }>> {
    return apiFetch(`/reviews/${encodeURIComponent(reviewId)}`, {
      method: "PATCH",
      body: payload,
    });
  },

  // Delete own review
  deleteReview(reviewId: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch(`/reviews/${encodeURIComponent(reviewId)}`, {
      method: "DELETE",
    });
  },
};
