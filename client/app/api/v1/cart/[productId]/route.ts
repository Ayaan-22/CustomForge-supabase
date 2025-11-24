import { cookies } from "next/headers"
import { NextResponse } from "next/server"

type CartCookie = { items: Array<{ productId: string; quantity: number }>; couponCode?: string | null }

function load(): CartCookie {
  const raw = cookies().get("cf_cart")?.value
  return raw ? (JSON.parse(raw) as CartCookie) : { items: [] }
}

export async function PATCH(req: Request, { params }: { params: { productId: string } }) {
  const body = (await req.json()) as { quantity: number }
  const cart = load()
  if (body.quantity <= 0) {
    cart.items = cart.items.filter((i) => i.productId !== params.productId)
  } else {
    const idx = cart.items.findIndex((i) => i.productId === params.productId)
    if (idx >= 0) cart.items[idx].quantity = body.quantity
    else cart.items.push({ productId: params.productId, quantity: body.quantity })
  }
  const res = NextResponse.json({ cart })
  res.cookies.set({ name: "cf_cart", value: JSON.stringify(cart), path: "/", sameSite: "lax" })
  return res
}

export async function DELETE(_: Request, { params }: { params: { productId: string } }) {
  const cart = load()
  cart.items = cart.items.filter((i) => i.productId !== params.productId)
  const res = NextResponse.json({ cart })
  res.cookies.set({ name: "cf_cart", value: JSON.stringify(cart), path: "/", sameSite: "lax" })
  return res
}
