import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const raw = cookies().get("cf_wishlist")?.value
  const ids = (raw ? JSON.parse(raw) : []) as string[]
  if (!ids.includes(params.id)) ids.push(params.id)
  const res = NextResponse.json({ message: "added" })
  res.cookies.set({ name: "cf_wishlist", value: JSON.stringify(ids), path: "/", sameSite: "lax" })
  return res
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const raw = cookies().get("cf_wishlist")?.value
  const ids = (raw ? JSON.parse(raw) : []) as string[]
  const next = ids.filter((x) => x !== params.id)
  const res = NextResponse.json({ message: "removed" })
  res.cookies.set({ name: "cf_wishlist", value: JSON.stringify(next), path: "/", sameSite: "lax" })
  return res
}
