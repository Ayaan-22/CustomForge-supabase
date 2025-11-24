"use client"

import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthService } from "@/services/auth-service"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const { toast } = useToast()
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const email = (form.querySelector("#email") as HTMLInputElement).value
    const password = (form.querySelector("#password") as HTMLInputElement).value
    const res = await AuthService.login({ email, password })
    if (res.error) {
      toast({ title: "Sign in failed", description: res.error.message, variant: "destructive" })
      return
    }
    location.href = "/profile"
  }

  return (
    <div className="container mx-auto grid place-items-center px-4 py-12">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-md border bg-card/60 p-6">
        <h1 className="font-heading text-2xl">Sign in</h1>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required />
        </div>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary">
            Register
          </Link>
        </div>
      </form>
    </div>
  )
}
