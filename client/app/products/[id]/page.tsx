"use client"

import { useEffect, useState } from "react"
import { useParams, notFound } from "next/navigation"
import type { Product } from "@/lib/types"
import { ProductGallery } from "@/components/product-gallery"
import { RatingStars } from "@/components/rating-stars"
import { finalPrice, formatPrice } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductCard } from "@/components/product-card"
import { apiFetch } from "@/lib/apiClient"
import { useCart } from "@/hooks/use-cart"
import { useWishlist } from "@/hooks/use-wishlist"
import { Heart, ShoppingCart, Check } from "lucide-react"

export default function ProductPage() {
  const params = useParams()
  const id = params.id as string
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [notFoundState, setNotFoundState] = useState(false)
  const { addItem: addToCart } = useCart()
  const { items: wishlistItems, addItem: addToWishlist, removeItem: removeFromWishlist } = useWishlist()
  const [addedToCart, setAddedToCart] = useState(false)

  const isInWishlist = wishlistItems.some((item) => item.id === id)

  useEffect(() => {
    async function loadProduct() {
      setLoading(true)
      console.log("[v0] ProductPage: Fetching product", id)
      const res = await apiFetch<{ item: Product }>(`/products/${id}`)
      console.log("[v0] ProductPage: Response:", res)

      if (res.error || !res.data?.item) {
        setNotFoundState(true)
        setLoading(false)
        return
      }

      const prod = res.data.item
      setProduct(prod)

      // Load related products
      const relRes = await apiFetch<{ items: Product[] }>(`/products/${id}/related`)
      if (relRes.data?.items) {
        setRelated(relRes.data.items)
      }

      setLoading(false)
    }
    loadProduct()
  }, [id])

  if (notFoundState) {
    return notFound()
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
    )
  }

  if (!product) return null

  const price = finalPrice(product.originalPrice, product.discountPercentage)

  const handleAddToCart = () => {
    addToCart(product)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const handleWishlistToggle = () => {
    if (isInWishlist) {
      removeFromWishlist(product.id)
    } else {
      addToWishlist(product)
    }
  }

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
              <div className="text-3xl font-semibold text-primary">{formatPrice(price)}</div>
              {product.discountPercentage ? (
                <div className="text-sm text-muted-foreground line-through">{formatPrice(product.originalPrice)}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <span className="rounded border px-2 py-1 text-sm">{product.availability || "In Stock"}</span>
            {product.warranty && (
              <span className="ml-2 text-sm text-muted-foreground">Warranty: {product.warranty}</span>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleAddToCart} disabled={product.availability === "Out of Stock"} className="flex-1">
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
            <Button variant="secondary" onClick={handleWishlistToggle}>
              <Heart className={`h-4 w-4 ${isInWishlist ? "fill-current text-red-500" : ""}`} />
            </Button>
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <h2 className="font-heading text-xl">Description</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {product.description || "High-performance component for gamers and creators."}
              </p>
            </div>
            {product.specifications && product.specifications.length > 0 && (
              <div>
                <h2 className="font-heading text-xl">Specifications</h2>
                <ul className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  {product.specifications.map((s) => (
                    <li key={s.key} className="flex items-center justify-between rounded-md border bg-card/60 p-2">
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
  )
}
