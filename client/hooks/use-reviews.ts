"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReviewService,
  type AddReviewPayload,
  type UpdateReviewPayload,
  type ReviewsQuery,
} from "@/services/review-service";
import type { Review } from "@/lib/types";

export function useProductReviews(productId: string, query?: ReviewsQuery) {
  return useQuery({
    queryKey: ["reviews", productId, query],
    queryFn: async () => {
      const response = await ReviewService.getProductReviews(productId, query);
      return response.data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useAddReview(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["reviews", "add", productId],
    mutationFn: (payload: AddReviewPayload) =>
      ReviewService.addReview(productId, payload),
    onSuccess: () => {
      // Invalidate reviews for this product
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      // Invalidate product data to refresh rating
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
  });
}

export function useUpdateReview(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["reviews", "update"],
    mutationFn: ({
      reviewId,
      payload,
    }: {
      reviewId: string;
      payload: UpdateReviewPayload;
    }) => ReviewService.updateReview(reviewId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
  });
}

export function useDeleteReview(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["reviews", "delete"],
    mutationFn: (reviewId: string) => ReviewService.deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
    // Optimistic update
    onMutate: async (reviewId) => {
      await queryClient.cancelQueries({ queryKey: ["reviews", productId] });
      const previousReviews = queryClient.getQueryData<Review[]>([
        "reviews",
        productId,
      ]);

      if (previousReviews) {
        queryClient.setQueryData<Review[]>(
          ["reviews", productId],
          previousReviews.filter((review) => review.id !== reviewId)
        );
      }

      return { previousReviews };
    },
    onError: (err, reviewId, context) => {
      if (context?.previousReviews) {
        queryClient.setQueryData(
          ["reviews", productId],
          context.previousReviews
        );
      }
    },
  });
}
