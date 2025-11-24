"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthService } from "@/services/auth-service"
import { useToast } from "@/hooks/use-toast"

export default function ForgotPasswordPage() {
  const { toast } = useToast()
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const email = (form.querySelector("#email") as HTMLInputElement).value
    const res = await AuthService.forgotPassword({ email })
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }
    toast({ title: "Success", description: "Password reset link sent to your email" })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="container mx-auto grid place-items-center px-4 py-12">
        <div className="w-full max-w-md space-y-4 rounded-md border bg-card/60 p-6 text-center">
          <h1 className="font-heading text-2xl">Check your email</h1>
          <p className="text-sm text-muted-foreground">We sent a password reset link to your email address.</p>
          <Link href="/login">
            <Button variant="outline" className="w-full bg-transparent">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto grid place-items-center px-4 py-12">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-md border bg-card/60 p-6">
        <h1 className="font-heading text-2xl">Forgot password</h1>
        <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link</p>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required />
        </div>
        <Button type="submit" className="w-full">
          Send reset link
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="text-primary">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  )
}
