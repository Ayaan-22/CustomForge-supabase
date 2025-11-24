"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserService } from "@/services/user-service"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/lib/types"

export default function EditProfilePage() {
  const { toast } = useToast()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    UserService.me().then((res) => {
      if (res.data?.user) {
        setUser(res.data.user)
      }
      setLoading(false)
    })
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const name = (form.querySelector("#name") as HTMLInputElement).value
    const phone = (form.querySelector("#phone") as HTMLInputElement).value

    const res = await UserService.updateMe({ name, phone })
    setSaving(false)

    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }

    toast({ title: "Success", description: "Profile updated" })
    router.push("/profile")
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
      <h1 className="font-heading mb-6 text-2xl">Edit profile</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-md border bg-card/60 p-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" defaultValue={user.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" defaultValue={user.email} disabled />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" defaultValue={user.phone || ""} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/profile")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
