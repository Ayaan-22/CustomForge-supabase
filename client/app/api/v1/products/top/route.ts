import { MOCK_PRODUCTS } from "@/app/api/products/data"
import { ok } from "../../_utils"

export async function GET() {
  const items = [...MOCK_PRODUCTS].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 8)
  return ok({ items })
}
