import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { err } from "../../_utils"

export async function PATCH(req: Request) {
  const raw = cookies().get("cf_user")?.value
  if (!raw) return err("Unauthorized", 401)
  const current = JSON.parse(raw)
  const body = await req.json()
  const user = { ...current, ...body, updatedAt: new Date().toISOString() }
  const res = NextResponse.json({ user })
  res.cookies.set({ name: "cf_user", value: JSON.stringify(user), path: "/", sameSite: "lax" })
  return res
}
