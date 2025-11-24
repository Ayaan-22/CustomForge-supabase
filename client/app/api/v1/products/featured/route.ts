import { MOCK_PRODUCTS } from "@/app/api/products/data"
import { ok } from "../../_utils"

export async function GET() {
  return ok({ items: MOCK_PRODUCTS.filter((p) => p.isFeatured) })
}
