import { NextResponse } from "next/server"

export async function GET() {
  const res = NextResponse.json({ message: "logged out" })
  res.cookies.set({ name: "cf_user", value: "", path: "/", maxAge: 0 })
  return res
}
