import { cookies } from "next/headers"
import { MOCK_PRODUCTS } from "@/app/api/products/data"
import { ok } from "../../_utils"

export async function GET() {
  const ids = (cookies().get("cf_wishlist")?.value ? JSON.parse(cookies().get("cf_wishlist")!.value) : []) as string[]
  const items = MOCK_PRODUCTS.filter((p) => ids.includes(p.id))
  return ok({ items })
}
