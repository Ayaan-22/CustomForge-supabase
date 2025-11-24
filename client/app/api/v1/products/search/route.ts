import { MOCK_PRODUCTS } from "@/app/api/products/data"
import { ok } from "../../_utils"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") || "").toLowerCase()
  const items = MOCK_PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q),
  )
  return ok({ items })
}
