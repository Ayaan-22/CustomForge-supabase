"use client"

import type React from "react"

import { useCart } from "@/hooks/use-cart"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPrice } from "@/lib/format"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export default function CheckoutPage() {
  const { subtotal, clear } = useCart()
  const { toast } = useToast()
  const router = useRouter()

  function placeOrder(e: React.FormEvent) {
    e.preventDefault()
    toast({ title: "Order placed!", description: "Thanks for your purchase. A confirmation email is on its way." })
    clear()
    router.push("/")
  }

  return (
    <div className="container mx-auto grid gap-6 px-4 py-6 md:grid-cols-[1fr_360px]">
      <form onSubmit={placeOrder} className="space-y-4 rounded-md border bg-card/60 p-4">
        <h1 className="font-heading text-2xl">Checkout</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip">ZIP</Label>
            <Input id="zip" required />
          </div>
        </div>
        <Button type="submit" className="w-full">
          Place Order
        </Button>
      </form>
      <aside className="rounded-md border bg-card/60 p-4">
        <h2 className="font-heading text-xl">Order Summary</h2>
        <div className="mt-2 flex items-center justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">Taxes and shipping calculated at checkout.</div>
      </aside>
    </div>
  )
}
