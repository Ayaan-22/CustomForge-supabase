"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RatingStars } from "./rating-stars"
import { finalPrice, formatPrice } from "@/lib/format"
import type { Product } from "@/lib/types"
import { useCart } from "@/hooks/use-cart"
import { useToast } from "@/hooks/use-toast"

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const { toast } = useToast()
  const price = finalPrice(product.originalPrice, product.discountPercentage)

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
      <Card className="bg-card/60 backdrop-blur border-border/60 overflow-hidden">
        <Link href={`/products/${product.id}`} prefetch className="block">
          <CardHeader className="p-0">
            <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
              <img
                src={product.images[0] || "/placeholder.svg?height=300&width=400&query=Gaming product image"}
                alt={product.name}
                className="h-full w-full object-cover"
                crossOrigin="anonymous"
              />
            </div>
          </CardHeader>
        </Link>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link href={`/products/${product.id}`} className="line-clamp-1 font-medium">
                {product.name}
              </Link>
              <div className="text-xs text-muted-foreground">{product.brand}</div>
            </div>
            {!!product.discountPercentage && (
              <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
                {product.discountPercentage}% off
              </Badge>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <RatingStars value={product.ratings.average} />
            <div className="text-right">
              <div className="text-lg font-semibold text-primary">{formatPrice(price)}</div>
              {product.discountPercentage ? (
                <div className="text-xs text-muted-foreground line-through">{formatPrice(product.originalPrice)}</div>
              ) : null}
            </div>
          </div>
          <div className="mt-2">
            <Badge
              variant="outline"
              className={
                product.availability === "In Stock"
                  ? "border-primary/50 text-primary"
                  : product.availability === "Preorder"
                    ? "border-accent/50 text-accent-foreground"
                    : "border-destructive/50 text-destructive-foreground"
              }
            >
              {product.availability}
            </Badge>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <Button
            className="w-full"
            disabled={product.availability === "Out of Stock"}
            onClick={() => {
              addItem(product, 1)
              toast({ title: "Added to cart", description: `${product.name} added to your cart.` })
            }}
          >
            Add to Cart
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
