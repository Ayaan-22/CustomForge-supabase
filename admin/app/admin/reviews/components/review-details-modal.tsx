"use client";

import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string;
  comment: string;
  verified_purchase: boolean;
  helpful_votes: number;
  reported: boolean;
  report_reason?: string;
  media: string[];
  platform?: string;
  playtime_hours?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  product?: {
    name: string;
  };
}

interface ReviewDetailsModalProps {
  review: Review;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReviewDetailsModal({
  review,
  open,
  onOpenChange,
}: ReviewDetailsModalProps) {
  if (!open) return null;

  // Helper to safely format dates
  const safeFormatDate = (dateValue: any, formatStr: string) => {
    if (!dateValue) return "N/A";
    const parsed = new Date(dateValue);
    if (isNaN(parsed.getTime())) return "Invalid Date";
    return format(parsed, formatStr);
  };

  const productName = review.product?.name || "Unknown Product";
  const userName = review.user?.name || "Unknown User";
  // const userAvatar = review.user?.avatar || "/placeholder.svg?height=32&width=32";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-[#1A1A24] to-[#0F0F14] border border-[#2A2A35] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2A2A35]">
          <h2 className="text-xl font-bold text-white">Review Details</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#A0A0A8] hover:bg-[#2A2A35]"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Product & Reviewer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[#A0A0A8] text-sm mb-2">Product</p>
              <p className="text-white font-medium">{productName}</p>
            </div>
            <div>
              <p className="text-[#A0A0A8] text-sm mb-2">Reviewer</p>
              <p className="text-white font-medium">{userName}</p>
            </div>
          </div>

          {/* Rating & Verified Purchase */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[#A0A0A8] text-sm mb-2">Rating</p>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < review.rating
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-[#2A2A35]"
                    }`}
                  />
                ))}
                <span className="text-white font-medium ml-2">
                  {review.rating}/5
                </span>
              </div>
            </div>
            <div>
              <p className="text-[#A0A0A8] text-sm mb-2">Verified Purchase</p>
              <p className="text-white font-medium">
                {review.verified_purchase ? "Yes" : "No"}
              </p>
            </div>
          </div>

          {/* Title */}
          <div>
            <p className="text-[#A0A0A8] text-sm mb-2">Title</p>
            <p className="text-white font-medium">{review.title}</p>
          </div>

          {/* Comment */}
          <div>
            <p className="text-[#A0A0A8] text-sm mb-2">Comment</p>
            <p className="text-white bg-[#0F0F14] rounded-lg p-4 border border-[#2A2A35]">
              {review.comment}
            </p>
          </div>

          {/* Helpful Votes */}
          <div>
            <p className="text-[#A0A0A8] text-sm mb-2">Helpful Votes</p>
            <p className="text-2xl font-bold text-green-400">
              {review.helpful_votes}
            </p>
          </div>

          {/* Reported status and reason */}
          {review.reported && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400 font-medium mb-2">Reported</p>
              <p className="text-white text-sm">
                {review.report_reason || "No reason provided"}
              </p>
            </div>
          )}

          {/* Media gallery */}
          {review.media && review.media.length > 0 && (
            <div>
              <p className="text-[#A0A0A8] text-sm mb-3">Media</p>
              <div className="grid grid-cols-2 gap-3">
                {review.media.map((url, idx) => (
                  <img
                    key={idx}
                    src={url || "/placeholder.svg"}
                    alt={`Review media ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-[#2A2A35]"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[#A0A0A8] mb-1">Created</p>
              <p className="text-white">
                {safeFormatDate(review.created_at, "MMM dd, yyyy HH:mm")}
              </p>
            </div>
            <div>
              <p className="text-[#A0A0A8] mb-1">Updated</p>
              <p className="text-white">
                {safeFormatDate(review.updated_at, "MMM dd, yyyy HH:mm")}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-[#2A2A35]">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2A2A35] text-white hover:bg-[#2A2A35]"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
