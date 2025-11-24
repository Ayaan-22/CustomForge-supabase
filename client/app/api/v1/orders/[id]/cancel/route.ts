import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { err } from "../../../_utils"

export async function PUT(_: Request, { params }: { params: { id: string } }) {
  const raw = cookies().get("cf_orders")?.value
  const orders = (raw ? JSON.parse(raw) : []) as any[]
  const idx = orders.findIndex((o) => o.id === params.id)
  if (idx < 0) return err("Not found", 404)
  orders[idx].status = "cancelled"
  const res = NextResponse.json({ order: orders[idx] })
  res.cookies.set({ name: "cf_orders", value: JSON.stringify(orders), path: "/", sameSite: "lax" })
  return res
}
