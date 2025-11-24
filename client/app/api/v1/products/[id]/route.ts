import { MOCK_PRODUCTS } from "@/app/api/products/data"
import { err, ok } from "../../_utils"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const item = MOCK_PRODUCTS.find((p) => p.id === params.id)
  if (!item) return err("Not found", 404)
  return ok({ item })
}
