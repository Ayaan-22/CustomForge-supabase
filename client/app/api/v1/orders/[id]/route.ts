import { cookies } from "next/headers"
import { err, ok } from "../../_utils"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const raw = cookies().get("cf_orders")?.value
  const orders = (raw ? JSON.parse(raw) : []) as any[]
  const order = orders.find((o) => o.id === params.id)
  if (!order) return err("Not found", 404)
  return ok({ order })
}
