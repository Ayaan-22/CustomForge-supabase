"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsInWishlist, useToggleWishlist } from "@/hooks/use-wishlist";
import { toast } from "sonner";

type WishlistButtonProps = {
  productId: string;
  variant?: "default" | "icon";
  className?: string;
};

export function WishlistButton({
  productId,
  variant = "default",
  className = "",
}: WishlistButtonProps) {
  const isInWishlist = useIsInWishlist(productId);
  const { toggle, isLoading } = useToggleWishlist();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await toggle(productId, isInWishlist);
      toast.success(
        isInWishlist ? "Removed from wishlist" : "Added to wishlist"
      );
    } catch (error) {
      toast.error("Failed to update wishlist. Please try again.");
    }
  };

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={isLoading}
        className={className}
        aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart
          className={`h-5 w-5 transition-colors ${
            isInWishlist
              ? "fill-red-500 text-red-500"
              : "text-muted-foreground hover:text-red-500"
          }`}
        />
      </Button>
    );
  }

  return (
    <Button
      variant={isInWishlist ? "default" : "outline"}
      onClick={handleClick}
      disabled={isLoading}
      className={className}
    >
      <Heart className={`mr-2 h-4 w-4 ${isInWishlist ? "fill-current" : ""}`} />
      {isInWishlist ? "In Wishlist" : "Add to Wishlist"}
    </Button>
  );
}
