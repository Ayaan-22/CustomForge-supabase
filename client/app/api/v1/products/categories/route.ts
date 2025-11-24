import { MOCK_PRODUCTS } from "@/app/api/products/data"
import { ok } from "../../_utils"

export async function GET() {
  const items = Array.from(new Set(MOCK_PRODUCTS.map((p) => p.category)))
  return ok({ items })
}
