import { MOCK_PRODUCTS } from "@/app/api/products/data"
import { ok } from "../../../_utils"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const current = MOCK_PRODUCTS.find((p) => p.id === params.id)
  const items = current
    ? MOCK_PRODUCTS.filter((p) => p.category === current.category && p.id !== current.id).slice(0, 8)
    : []
  return ok({ items })
}
