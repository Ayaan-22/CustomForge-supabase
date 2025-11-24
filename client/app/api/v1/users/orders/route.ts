import { cookies } from "next/headers"
import { ok } from "../../_utils"

type Order = {
  id: string
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "returned"
  items: Array<{ productId: string; quantity: number }>
  total: number
  createdAt: string
}

export async function GET() {
  const raw = cookies().get("cf_orders")?.value
  const items = (raw ? JSON.parse(raw) : []) as Order[]
  return ok({ items })
}
