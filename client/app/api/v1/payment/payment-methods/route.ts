import { cookies } from "next/headers"
import { NextResponse } from "next/server"

type Method = { id: string; type: "card"; brand?: string; last4?: string; expMonth?: number; expYear?: number }

export async function GET() {
  const raw = cookies().get("cf_methods")?.value
  const items = (raw ? JSON.parse(raw) : []) as Method[]
  return NextResponse.json({ items })
}

export async function POST() {
  const raw = cookies().get("cf_methods")?.value
  const items = (raw ? JSON.parse(raw) : []) as Method[]
  const method: Method = {
    id: crypto.randomUUID(),
    type: "card",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
  }
  items.unshift(method)
  const res = NextResponse.json({ method }, { status: 201 })
  res.cookies.set({ name: "cf_methods", value: JSON.stringify(items), path: "/", sameSite: "lax" })
  return res
}
