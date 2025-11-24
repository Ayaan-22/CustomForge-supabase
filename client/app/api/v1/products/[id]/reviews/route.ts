import { created, err, requireBody } from "../../../_utils"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await requireBody<{ rating: number; comment?: string }>(req)
  if (!body?.rating || body.rating < 1 || body.rating > 5) return err("Rating must be between 1-5", 400)
  const review = {
    id: crypto.randomUUID(),
    user: "demo-user",
    rating: body.rating,
    comment: body.comment || "",
    createdAt: new Date().toISOString(),
    productId: params.id,
  }
  // In a real DB you would persist and recalc aggregates; here we just echo back.
  return created({ review })
}
