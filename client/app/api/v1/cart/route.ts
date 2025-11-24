import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { MOCK_PRODUCTS } from "@/app/api/products/data"

type CartCookie = { items: Array<{ productId: string; quantity: number }>; couponCode?: string | null }

function loadCart(): CartCookie {
  const raw = cookies().get("cf_cart")?.value
  try {
    return raw ? (JSON.parse(raw) as CartCookie) : { items: [] }
  } catch {
    return { items: [] }
  }
}

function save(res: NextResponse, cart: CartCookie) {
  res.cookies.set({ name: "cf_cart", value: JSON.stringify(cart), path: "/", sameSite: "lax" })
}

function totals(cart: CartCookie) {
  const subtotal = cart.items.reduce((acc, it) => {
    const p = MOCK_PRODUCTS.find((x) => x.id === it.productId)
    if (!p) return acc
    const price = p.discountPercentage ? p.originalPrice * (1 - p.discountPercentage / 100) : p.originalPrice
    return acc + price * it.quantity
  }, 0)
  const discount = cart.couponCode === "SAVE10" ? subtotal * 0.1 : 0
  const total = subtotal - discount
  return { subtotal, discount, total }
}

export async function GET() {
  const cart = loadCart()
  const res = NextResponse.json({ cart: { ...cart, ...totals(cart) } })
  save(res, cart)
  return res
}

export async function POST(req: Request) {
  const body = (await req.json()) as CartCookie
  const cart: CartCookie = { items: body.items || [], couponCode: body.couponCode || null }
  const res = NextResponse.json({ cart: { ...cart, ...totals(cart) } }, { status: 201 })
  save(res, cart)
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ message: "cleared" })
  res.cookies.set({ name: "cf_cart", value: JSON.stringify({ items: [] }), path: "/", sameSite: "lax" })
  return res
}
