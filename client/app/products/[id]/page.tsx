"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import type { Product } from "@/lib/types";
import { ProductGallery } from "@/components/product-gallery";
import { RatingStars } from "@/components/rating-stars";
import { finalPrice, formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product-card";
import { apiFetch } from "@/lib/apiClient";
import { useCart } from "@/hooks/use-cart";
import { useIsInWishlist, useToggleWishlist } from "@/hooks/use-wishlist";
import { Heart, ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";

export default function ProductPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const { addItem: addToCart } = useCart();
  const isInWishlist = useIsInWishlist(id);
  const { toggle: toggleWishlist, isLoading: wishlistLoading } =
    useToggleWishlist();
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      console.log("[v0] ProductPage: Fetching product", id);
      const res = await apiFetch<Product>(`/products/${id}`);
      console.log("[v0] ProductPage: Response:", res);

      if (res.error || !res.data) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }

      const prod = res.data;
      console.log("[v0] Product data:", prod);
      console.log("[v0] Specifications:", prod.specifications);
      console.log("[v0] Features:", prod.features);
      console.log("[v0] All product keys:", Object.keys(prod));
      setProduct(prod);

      // Load related products
      const relRes = await apiFetch<Product[]>(`/products/${id}/related`);
      if (relRes.data) {
        setRelated(relRes.data);
      }

      setLoading(false);
    }
    loadProduct();
  }, [id]);

  if (notFoundState) {
    return notFound();
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const price = finalPrice(product.originalPrice, product.discountPercentage);

  const handleAddToCart = () => {
    addToCart(product);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleWishlistToggle = async () => {
    try {
      await toggleWishlist(id, isInWishlist);
      toast.success(
        isInWishlist ? "Removed from wishlist" : "Added to wishlist"
      );
    } catch (error) {
      toast.error("Failed to update wishlist");
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={product.images} />
        <div>
          <h1 className="font-heading text-3xl">{product.name}</h1>
          <div className="mt-2 text-muted-foreground">
            {product.brand} • {product.category} • SKU: {product.sku}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <RatingStars value={product.ratings?.average ?? 0} />
            <div className="text-right">
              <div className="text-3xl font-semibold text-primary">
                {formatPrice(price)}
              </div>
              {product.discountPercentage ? (
                <div className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.originalPrice)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded border px-3 py-1 text-sm font-medium">
              {product.availability || "In Stock"}
            </span>
            {product.stock !== undefined && (
              <span className="rounded border px-3 py-1 text-sm text-muted-foreground">
                Stock: {product.stock} units
              </span>
            )}
            {product.warranty && (
              <span className="rounded border px-3 py-1 text-sm text-muted-foreground">
                Warranty: {product.warranty}
              </span>
            )}
            {product.weight && (
              <span className="rounded border px-3 py-1 text-sm text-muted-foreground">
                Weight: {product.weight}kg
              </span>
            )}
            {product.ratings?.totalReviews > 0 && (
              <span className="rounded border px-3 py-1 text-sm text-muted-foreground">
                {product.ratings.totalReviews} reviews
              </span>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              onClick={handleAddToCart}
              disabled={product.availability === "Out of Stock"}
              className="flex-1"
            >
              {addedToCart ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Added!
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={handleWishlistToggle}
              disabled={wishlistLoading}
            >
              <Heart
                className={`h-4 w-4 ${
                  isInWishlist ? "fill-current text-red-500" : ""
                }`}
              />
            </Button>
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <h2 className="font-heading text-xl">Description</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {product.description ||
                  "High-performance component for gamers and creators."}
              </p>
            </div>
            {product.specifications && product.specifications.length > 0 && (
              <div>
                <h2 className="font-heading text-xl">Specifications</h2>
                <ul className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  {product.specifications.map((s) => (
                    <li
                      key={s.key}
                      className="flex items-center justify-between rounded-md border bg-card/60 p-2"
                    >
                      <span className="text-muted-foreground">{s.key}</span>
                      <span>{s.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {product.features && product.features.length > 0 && (
              <div>
                <h2 className="font-heading text-xl">Features</h2>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                  {product.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {product.dimensions && (
              <div>
                <h2 className="font-heading text-xl">Dimensions</h2>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  {product.dimensions.length && (
                    <div className="rounded-md border bg-card/60 p-2">
                      <span className="text-muted-foreground">Length:</span>{" "}
                      <span className="font-medium">
                        {product.dimensions.length}cm
                      </span>
                    </div>
                  )}
                  {product.dimensions.width && (
                    <div className="rounded-md border bg-card/60 p-2">
                      <span className="text-muted-foreground">Width:</span>{" "}
                      <span className="font-medium">
                        {product.dimensions.width}cm
                      </span>
                    </div>
                  )}
                  {product.dimensions.height && (
                    <div className="rounded-md border bg-card/60 p-2">
                      <span className="text-muted-foreground">Height:</span>{" "}
                      <span className="font-medium">
                        {product.dimensions.height}cm
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-2xl">Related Products</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
