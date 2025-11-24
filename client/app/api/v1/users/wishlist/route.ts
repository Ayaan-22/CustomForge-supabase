import { cookies } from "next/headers"
import { ok } from "../../_utils"

export async function GET() {
  const raw = cookies().get("cf_wishlist")?.value
  const ids = (raw ? JSON.parse(raw) : []) as string[]
  const items = ids.map((id: string) => ({ id: crypto.randomUUID(), productId: id, addedAt: new Date().toISOString() }))
  return ok({ items })
}
