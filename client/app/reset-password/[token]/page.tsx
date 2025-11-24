"use client"

import type React from "react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthService } from "@/services/auth-service"
import { useToast } from "@/hooks/use-toast"

export default function ResetPasswordPage() {
  const { toast } = useToast()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const form = e.target as HTMLFormElement
    const password = (form.querySelector("#password") as HTMLInputElement).value
    const confirmPassword = (form.querySelector("#confirmPassword") as HTMLInputElement).value

    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords don't match", variant: "destructive" })
      setLoading(false)
      return
    }

    const token = params.token as string
    const res = await AuthService.resetPassword(token, { password, confirmPassword })
    setLoading(false)

    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }

    toast({ title: "Success", description: "Password reset successful" })
    router.push("/login")
  }

  return (
    <div className="container mx-auto grid place-items-center px-4 py-12">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-md border bg-card/60 p-6">
        <h1 className="font-heading text-2xl">Reset password</h1>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" required minLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" required minLength={8} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </Button>
      </form>
    </div>
  )
}
