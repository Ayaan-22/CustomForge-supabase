"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { UserService } from "@/services/user-service"
import { useToast } from "@/hooks/use-toast"
import type { PaymentMethod } from "@/lib/types"

export default function PaymentMethodsPage() {
  const { toast } = useToast()
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMethods()
  }, [])

  async function loadMethods() {
    const res = await UserService.getPaymentMethods()
    if (res.data?.items) {
      setMethods(res.data.items)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment method?")) return
    const res = await UserService.deletePaymentMethod(id)
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }
    toast({ title: "Success", description: "Payment method deleted" })
    loadMethods()
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
        <h1 className="font-heading text-2xl">Payment methods</h1>
        <Link href="/payment-methods/new">
          <Button>Add payment method</Button>
        </Link>
      </div>

      {methods.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">No payment methods saved</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {methods.map((method) => (
            <Card key={method.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-16 items-center justify-center rounded border bg-muted">
                    <span className="text-xs font-semibold uppercase">{method.brand}</span>
                  </div>
                  <div>
                    <p className="font-medium">•••• {method.last4}</p>
                    <p className="text-sm text-muted-foreground">
                      Expires {method.expMonth}/{method.expYear}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(method.id)}>
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
