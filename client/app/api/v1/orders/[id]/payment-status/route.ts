import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const raw = cookies().get("cf_orders")?.value
  const orders = (raw ? JSON.parse(raw) : []) as any[]
  const idx = orders.findIndex((o) => o.id === params.id)
  if (idx >= 0) {
    orders[idx].status = "paid"
    const res = NextResponse.json({ status: "paid" as const })
    res.cookies.set({ name: "cf_orders", value: JSON.stringify(orders), path: "/", sameSite: "lax" })
    return res
  }
  return NextResponse.json({ status: "pending" as const })
}
