"use client"

import { useWishlist } from "@/hooks/use-wishlist"
import { ProductCard } from "@/components/product-card"

export default function WishlistPage() {
  const { items } = useWishlist()
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="font-heading text-2xl">Wishlist</h1>
      {items.length === 0 ? (
        <p className="mt-2 text-muted-foreground">Save items to your wishlist to view them later.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
