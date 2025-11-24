import { cookies } from "next/headers"
import { NextResponse } from "next/server"

type CartCookie = { items: Array<{ productId: string; quantity: number }>; couponCode?: string | null }

function load(): CartCookie {
  const raw = cookies().get("cf_cart")?.value
  return raw ? (JSON.parse(raw) as CartCookie) : { items: [] }
}

export async function POST(req: Request) {
  const body = (await req.json()) as { code: string }
  const cart = load()
  cart.couponCode = body.code
  const res = NextResponse.json({ cart })
  res.cookies.set({ name: "cf_cart", value: JSON.stringify(cart), path: "/", sameSite: "lax" })
  return res
}

export async function DELETE() {
  const cart = load()
  cart.couponCode = null
  const res = NextResponse.json({ cart })
  res.cookies.set({ name: "cf_cart", value: JSON.stringify(cart), path: "/", sameSite: "lax" })
  return res
}
