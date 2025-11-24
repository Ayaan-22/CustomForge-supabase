"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { UserService } from "@/services/user-service"
import { AuthService } from "@/services/auth-service"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/lib/types"

export default function SecurityPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabling2FA, setEnabling2FA] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState("")

  useEffect(() => {
    UserService.me().then((res) => {
      if (res.data?.user) {
        setUser(res.data.user)
      }
      setLoading(false)
    })
  }, [])

  async function handleEnable2FA() {
    setEnabling2FA(true)
    const res = await AuthService.enable2fa({ method: "app" })
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      setEnabling2FA(false)
      return
    }
    if (res.data?.secretUrl) {
      setQrCode(res.data.secretUrl)
    }
  }

  async function handleVerify2FA() {
    const res = await AuthService.verify2fa({ code: verifyCode })
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }
    toast({ title: "Success", description: "Two-factor authentication enabled" })
    setQrCode(null)
    setEnabling2FA(false)
    setVerifyCode("")
    // Refresh user
    const userRes = await UserService.me()
    if (userRes.data?.user) {
      setUser(userRes.data.user)
    }
  }

  async function handleDisable2FA() {
    const res = await AuthService.disable2fa()
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }
    toast({ title: "Success", description: "Two-factor authentication disabled" })
    // Refresh user
    const userRes = await UserService.me()
    if (userRes.data?.user) {
      setUser(userRes.data.user)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Loading...</h1>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Please sign in</h1>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading mb-6 text-2xl">Security settings</h1>

      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Two-factor authentication</h2>
              <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
            </div>
            <Switch
              checked={user.twoFactorEnabled || false}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleEnable2FA()
                } else {
                  handleDisable2FA()
                }
              }}
            />
          </div>

          {qrCode && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <p className="text-sm">Scan this QR code with your authenticator app:</p>
              <img src={qrCode || "/placeholder.svg"} alt="QR Code" className="mx-auto h-48 w-48" />
              <div className="space-y-2">
                <Label htmlFor="verifyCode">Enter 6-digit code</Label>
                <Input
                  id="verifyCode"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  maxLength={6}
                  placeholder="000000"
                />
              </div>
              <Button onClick={handleVerify2FA} disabled={verifyCode.length !== 6}>
                Verify and enable
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-2 font-semibold">Password</h2>
          <p className="mb-4 text-sm text-muted-foreground">Change your password to keep your account secure</p>
          <Button variant="outline" onClick={() => router.push("/profile/change-password")}>
            Change password
          </Button>
        </Card>
      </div>
    </div>
  )
}
