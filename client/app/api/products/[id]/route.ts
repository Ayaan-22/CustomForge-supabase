import { MOCK_PRODUCTS } from "@/app/api/products/data"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const product = MOCK_PRODUCTS.find((p) => p.id === params.id)
  if (!product) return new Response("Not found", { status: 404 })
  return Response.json(product)
}
