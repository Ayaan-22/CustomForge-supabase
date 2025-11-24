import { res, requireAuth, setAuthUser } from "../../../_utils"

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const user = requireAuth()
  setAuthUser({ ...user, verified: true })
  return res.json({ ok: true, token: params.token })
}
