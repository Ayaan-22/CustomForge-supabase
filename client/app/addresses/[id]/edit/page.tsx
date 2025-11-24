"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserService } from "@/services/user-service"
import { useToast } from "@/hooks/use-toast"
import type { Address } from "@/lib/types"

export default function EditAddressPage() {
  const { toast } = useToast()
  const params = useParams()
  const router = useRouter()
  const [address, setAddress] = useState<Address | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const id = params.id as string
    UserService.getAddresses().then((res) => {
      if (res.data?.items) {
        const found = res.data.items.find((a) => a.id === id)
        if (found) {
          setAddress(found)
        }
      }
      setLoading(false)
    })
  }, [params.id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address) return
    setSaving(true)
    const form = e.target as HTMLFormElement

    const updated = {
      line1: (form.querySelector("#line1") as HTMLInputElement).value,
      line2: (form.querySelector("#line2") as HTMLInputElement).value,
      city: (form.querySelector("#city") as HTMLInputElement).value,
      state: (form.querySelector("#state") as HTMLInputElement).value,
      postalCode: (form.querySelector("#postalCode") as HTMLInputElement).value,
      country: (form.querySelector("#country") as HTMLInputElement).value,
    }

    const res = await UserService.updateAddress(address.id, updated)
    setSaving(false)

    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }

    toast({ title: "Success", description: "Address updated" })
    router.push("/addresses")
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Loading...</h1>
      </div>
    )
  }

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Address not found</h1>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading mb-6 text-2xl">Edit address</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-md border bg-card/60 p-6">
        <div className="space-y-2">
          <Label htmlFor="line1">Address line 1</Label>
          <Input id="line1" defaultValue={address.line1} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="line2">Address line 2 (optional)</Label>
          <Input id="line2" defaultValue={address.line2 || ""} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" defaultValue={address.city} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" defaultValue={address.state || ""} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" defaultValue={address.postalCode} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" defaultValue={address.country} required />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Update address"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/addresses")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
