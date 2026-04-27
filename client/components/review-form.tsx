"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAddReview } from "@/hooks/use-reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type ReviewFormProps = {
  productId: string;
  onSuccess?: () => void;
};

export function ReviewForm({ productId, onSuccess }: ReviewFormProps) {
  const router = useRouter();
  const { isAuthenticated, isEmailVerified } = useAuth();
  const addReview = useAddReview(productId);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check authentication
    if (!isAuthenticated) {
      toast.error("Please login to leave a review");
      router.push("/login");
      return;
    }

    // Check email verification
    if (!isEmailVerified) {
      toast.error("Please verify your email to leave a review");
      router.push("/verify-email");
      return;
    }

    // Validate
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (!comment.trim()) {
      toast.error("Please write a comment");
      return;
    }

    try {
      const response = await addReview.mutateAsync({
        rating,
        comment: comment.trim(),
        title: title.trim() || undefined,
      });

      if (response.error) {
        toast.error(response.error.message || "Failed to submit review");
      } else {
        toast.success("Review submitted successfully!");
        // Reset form
        setRating(0);
        setTitle("");
        setComment("");
        onSuccess?.();
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Rating *</Label>
        <div className="flex gap-1 mt-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`h-8 w-8 ${
                  star <= (hoverRating || rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum up your experience"
          maxLength={100}
        />
      </div>

      <div>
        <Label htmlFor="review-comment">Your Review *</Label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts about this product..."
          rows={4}
          maxLength={1000}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          {comment.length}/1000 characters
        </p>
      </div>

      <Button type="submit" disabled={addReview.isPending}>
        {addReview.isPending ? "Submitting..." : "Submit Review"}
      </Button>
    </form>
  );
}
