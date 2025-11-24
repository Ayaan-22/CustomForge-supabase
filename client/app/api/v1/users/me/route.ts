import { cookies } from "next/headers"
import { err, ok } from "../../_utils"

export async function GET() {
  const raw = cookies().get("cf_user")?.value
  if (!raw) return err("Unauthorized", 401)
  return ok({ user: JSON.parse(raw) })
}
