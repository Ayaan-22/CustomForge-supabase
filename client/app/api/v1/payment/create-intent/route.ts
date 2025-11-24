import { NextResponse } from "next/server"

export async function POST() {
  const intent = {
    id: crypto.randomUUID(),
    clientSecret: crypto.randomUUID(),
    amount: 0,
    currency: "usd",
    status: "requires_payment_method" as const,
  }
  return NextResponse.json({ intent }, { status: 201 })
}
