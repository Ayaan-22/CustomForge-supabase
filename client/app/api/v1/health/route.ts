import { ok } from "../_utils"

export async function GET() {
  return ok({ status: "ok", env: "mock" })
}
