"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { UserService } from "@/services/user-service"
import { AuthService } from "@/services/auth-service"

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    UserService.me().then((r) => {
      if (!active) return
      if (r.data?.user) {
        setName(r.data.user.name)
        setEmail(r.data.user.email)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Loading...</h1>
      </div>
    )
  }

  if (!name) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Please sign in</h1>
        <p className="mt-2 text-muted-foreground">You need an account to view your profile.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Welcome, {name}</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <Link href="/profile/edit">
          <Button variant="outline">Edit profile</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/orders">
          <Card className="p-6 transition-colors hover:bg-accent">
            <h2 className="font-semibold">Orders</h2>
            <p className="text-sm text-muted-foreground">View your order history</p>
          </Card>
        </Link>

        <Link href="/wishlist">
          <Card className="p-6 transition-colors hover:bg-accent">
            <h2 className="font-semibold">Wishlist</h2>
            <p className="text-sm text-muted-foreground">Saved items</p>
          </Card>
        </Link>

        <Link href="/addresses">
          <Card className="p-6 transition-colors hover:bg-accent">
            <h2 className="font-semibold">Addresses</h2>
            <p className="text-sm text-muted-foreground">Manage shipping addresses</p>
          </Card>
        </Link>

        <Link href="/payment-methods">
          <Card className="p-6 transition-colors hover:bg-accent">
            <h2 className="font-semibold">Payment methods</h2>
            <p className="text-sm text-muted-foreground">Manage saved cards</p>
          </Card>
        </Link>

        <Link href="/profile/security">
          <Card className="p-6 transition-colors hover:bg-accent">
            <h2 className="font-semibold">Security</h2>
            <p className="text-sm text-muted-foreground">Password & 2FA settings</p>
          </Card>
        </Link>
      </div>

      <Button
        variant="outline"
        onClick={async () => {
          await AuthService.logout()
          location.href = "/"
        }}
      >
        Sign out
      </Button>
    </div>
  )
}
