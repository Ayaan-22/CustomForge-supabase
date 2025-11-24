import { ok } from "../../../_utils"
export async function POST() {
  return ok({ secretUrl: "otpauth://totp/CustomForge:demo?secret=DEMOSECRET&issuer=CustomForge" })
}
