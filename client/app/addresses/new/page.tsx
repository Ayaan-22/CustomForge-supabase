"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserService } from "@/services/user-service"
import { useToast } from "@/hooks/use-toast"

export default function NewAddressPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const form = e.target as HTMLFormElement

    const address = {
      line1: (form.querySelector("#line1") as HTMLInputElement).value,
      line2: (form.querySelector("#line2") as HTMLInputElement).value,
      city: (form.querySelector("#city") as HTMLInputElement).value,
      state: (form.querySelector("#state") as HTMLInputElement).value,
      postalCode: (form.querySelector("#postalCode") as HTMLInputElement).value,
      country: (form.querySelector("#country") as HTMLInputElement).value,
    }

    const res = await UserService.addAddress(address)
    setLoading(false)

    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }

    toast({ title: "Success", description: "Address added" })
    router.push("/addresses")
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading mb-6 text-2xl">Add address</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-md border bg-card/60 p-6">
        <div className="space-y-2">
          <Label htmlFor="line1">Address line 1</Label>
          <Input id="line1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="line2">Address line 2 (optional)</Label>
          <Input id="line2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" required />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Add address"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/addresses")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
