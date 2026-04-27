"use client";

import { useProductReviews, useDeleteReview } from "@/hooks/use-reviews";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type ReviewListProps = {
  productId: string;
};

export function ReviewList({ productId }: ReviewListProps) {
  const { user } = useAuth();
  const { data: reviews, isLoading, error } = useProductReviews(productId);
  const deleteReview = useDeleteReview(productId);

  const handleDelete = async (reviewId: string) => {
    if (!confirm("Are you sure you want to delete this review?")) {
      return;
    }

    try {
      const response = await deleteReview.mutateAsync(reviewId);
      if (response.error) {
        toast.error(response.error.message || "Failed to delete review");
      } else {
        toast.success("Review deleted successfully");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load reviews. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No reviews yet. Be the first to review this product!
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const isOwnReview = user?.id === review.userId;

        return (
          <Card key={review.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium">
                      {review.userName || "Anonymous"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {review.createdAt &&
                        formatDistanceToNow(new Date(review.createdAt), {
                          addSuffix: true,
                        })}
                    </span>
                  </div>

                  {review.title && (
                    <h4 className="font-semibold mb-1">{review.title}</h4>
                  )}

                  <p className="text-sm text-muted-foreground">
                    {review.comment}
                  </p>
                </div>

                {isOwnReview && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(review.id)}
                    disabled={deleteReview.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
