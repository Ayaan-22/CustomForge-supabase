import { MOCK_PRODUCTS } from "@/app/api/products/data"
import { ok } from "../../../_utils"

export async function GET(_: Request, { params }: { params: { category: string } }) {
  const items = MOCK_PRODUCTS.filter((p) => p.category === decodeURIComponent(params.category))
  return ok({ items })
}
