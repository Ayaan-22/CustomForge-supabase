"use client";

import { useWishlist } from "@/hooks/use-wishlist";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Product } from "@/lib/types";

// Component to fetch and display a product from wishlist item
function WishlistProductCard({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProduct() {
      const res = await apiFetch<Product>(`/products/${productId}`);
      if (res.data) {
        setProduct(res.data);
      }
      setLoading(false);
    }
    fetchProduct();
  }, [productId]);

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-lg" />;
  }

  if (!product) {
    return null;
  }

  return <ProductCard product={product} />;
}

export default function WishlistPage() {
  const { data: items, isLoading, error } = useWishlist();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="font-heading text-2xl">Wishlist</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="font-heading text-2xl">Wishlist</h1>
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load wishlist. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const wishlistItems = items || [];

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="font-heading text-2xl">Wishlist</h1>
      {wishlistItems.length === 0 ? (
        <p className="mt-2 text-muted-foreground">
          Save items to your wishlist to view them later.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {wishlistItems.map((item) => (
            <WishlistProductCard
              key={item.productId}
              productId={item.productId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
