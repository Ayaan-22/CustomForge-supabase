"use client"

import { useCart } from "@/hooks/use-cart"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPrice } from "@/lib/format"
import Link from "next/link"

export default function CartPage() {
  const { items, updateQty, removeItem, subtotal, clear } = useCart()

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Find something you love and add it to your cart.</p>
        <Link href="/products">
          <Button className="mt-4">Shop Now</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto grid gap-8 px-4 py-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {items.map(({ product, quantity }) => (
          <div
            key={product.id}
            className="grid grid-cols-[80px_1fr_auto] items-center gap-4 rounded-md border bg-card/60 p-3"
          >
            <img
              src={product.images[0] || "/placeholder.svg?height=80&width=80&query=Product thumbnail"}
              alt={product.name}
              className="h-20 w-20 rounded object-cover"
              crossOrigin="anonymous"
            />
            <div>
              <div className="font-medium">{product.name}</div>
              <div className="text-xs text-muted-foreground">{product.brand}</div>
              <button className="text-xs text-destructive" onClick={() => removeItem(product.id)}>
                Remove
              </button>
            </div>
            <div className="text-right">
              <Input
                type="number"
                min={1}
                value={quantity}
                className="w-20"
                onChange={(e) => updateQty(product.id, Number(e.target.value))}
              />
              <div className="mt-1 text-sm">
                {formatPrice(
                  (product.discountPercentage
                    ? product.originalPrice * (1 - product.discountPercentage / 100)
                    : product.originalPrice) * quantity,
                )}
              </div>
            </div>
          </div>
        ))}
        <Button variant="ghost" onClick={clear}>
          Clear Cart
        </Button>
      </div>
      <aside className="rounded-md border bg-card/60 p-4">
        <h2 className="font-heading text-xl">Order Summary</h2>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>Calculated at checkout</span>
          </div>
        </div>
        <Link href="/checkout">
          <Button className="mt-4 w-full">Checkout</Button>
        </Link>
      </aside>
    </div>
  )
}
