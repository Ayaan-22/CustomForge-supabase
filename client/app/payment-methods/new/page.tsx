"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export default function NewPaymentMethodPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    // This would integrate with Stripe or your payment processor
    toast({
      title: "Not implemented",
      description: "Payment method integration requires Stripe setup",
      variant: "destructive",
    })
    setLoading(false)
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading mb-6 text-2xl">Add payment method</h1>
      <Card className="p-6">
        <p className="mb-4 text-sm text-muted-foreground">
          Payment method integration requires Stripe Elements or similar payment processor setup.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Processing..." : "Add card"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/payment-methods")}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  )
}
