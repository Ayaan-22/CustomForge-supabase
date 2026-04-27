import { NextResponse } from "next/server"
import { setJSONCookie, created } from "../../_utils"

export async function POST(req: Request) {
  const body = await req.json()
  const user = {
    id: crypto.randomUUID(),
    name: body?.name || "Player One",
    email: body?.email || "user@example.com",
    role: "user",
    createdAt: new Date().toISOString(),
  }
  // Generate a mock token (in production, this would be a JWT from the backend)
  const token = `mock_token_${crypto.randomUUID()}`
  
  // Use created() helper and set cookie with proper maxAge
  return created(
    { 
      user,
      token 
    },
    (res: NextResponse) => {
      setJSONCookie(res, "cf_user", user, 7) // Set cookie with 7 days maxAge
    }
  )
}
