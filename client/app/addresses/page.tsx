"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserService } from "@/services/user-service"
import { useToast } from "@/hooks/use-toast"
import type { Address } from "@/lib/types"

export default function AddressesPage() {
  const { toast } = useToast()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAddresses()
  }, [])

  async function loadAddresses() {
    const res = await UserService.getAddresses()
    if (res.data?.items) {
      setAddresses(res.data.items)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this address?")) return
    const res = await UserService.deleteAddress(id)
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }
    toast({ title: "Success", description: "Address deleted" })
    loadAddresses()
  }

  async function handleSetDefault(id: string) {
    const res = await UserService.setDefaultAddress(id)
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }
    toast({ title: "Success", description: "Default address updated" })
    loadAddresses()
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Loading...</h1>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">My addresses</h1>
        <Link href="/addresses/new">
          <Button>Add address</Button>
        </Link>
      </div>

      {addresses.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">No addresses saved</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {addresses.map((address) => (
            <Card key={address.id} className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  {address.isDefault && (
                    <Badge variant="default" className="mb-2">
                      Default
                    </Badge>
                  )}
                  <p className="text-sm">
                    {address.line1}
                    {address.line2 && `, ${address.line2}`}
                  </p>
                  <p className="text-sm">
                    {address.city}, {address.state} {address.postalCode}
                  </p>
                  <p className="text-sm">{address.country}</p>
                </div>
                <div className="flex gap-2">
                  {!address.isDefault && (
                    <Button variant="outline" size="sm" onClick={() => handleSetDefault(address.id)}>
                      Set default
                    </Button>
                  )}
                  <Link href={`/addresses/${address.id}/edit`}>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(address.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
