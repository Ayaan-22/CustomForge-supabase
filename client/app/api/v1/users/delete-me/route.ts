import { NextResponse } from "next/server"
export async function DELETE() {
  const res = NextResponse.json({ message: "deleted" })
  res.cookies.set({ name: "cf_user", value: "", path: "/", maxAge: 0 })
  return res
}
