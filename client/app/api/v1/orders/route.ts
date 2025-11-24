import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { MOCK_PRODUCTS } from "@/app/api/products/data"

type CartCookie = { items: Array<{ productId: string; quantity: number }>; couponCode?: string | null }
type Order = {
  id: string
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "returned"
  items: Array<{ productId: string; quantity: number }>
  total: number
  createdAt: string
}

function priceFor(productId: string) {
  const p = MOCK_PRODUCTS.find((x) => x.id === productId)
  if (!p) return 0
  return p.discountPercentage ? p.originalPrice * (1 - p.discountPercentage / 100) : p.originalPrice
}

export async function GET() {
  const raw = cookies().get("cf_orders")?.value
  const items = (raw ? JSON.parse(raw) : []) as Order[]
  return NextResponse.json({ items })
}

export async function POST() {
  const cartRaw = cookies().get("cf_cart")?.value
  const cart = (cartRaw ? JSON.parse(cartRaw) : { items: [] }) as CartCookie
  const total = cart.items.reduce((acc: number, it: any) => acc + priceFor(it.productId) * it.quantity, 0)
  const order: Order = {
    id: crypto.randomUUID(),
    status: "pending",
    items: cart.items,
    total,
    createdAt: new Date().toISOString(),
  }
  const ordersRaw = cookies().get("cf_orders")?.value
  const orders = (ordersRaw ? JSON.parse(ordersRaw) : []) as Order[]
  orders.unshift(order)
  const res = NextResponse.json({ order }, { status: 201 })
  res.cookies.set({ name: "cf_orders", value: JSON.stringify(orders), path: "/", sameSite: "lax" })
  return res
}
