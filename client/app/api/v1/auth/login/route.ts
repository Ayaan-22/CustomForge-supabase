import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()
  const user = {
    id: crypto.randomUUID(),
    name: "CustomForge Gamer",
    email: body?.email || "user@example.com",
    role: "user",
    createdAt: new Date().toISOString(),
  }
  const res = NextResponse.json({ user })
  res.cookies.set({ name: "cf_user", value: JSON.stringify(user), path: "/", sameSite: "lax" })
  return res
}
