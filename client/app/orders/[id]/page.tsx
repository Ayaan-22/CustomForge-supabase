"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { OrderService } from "@/services/order-service"
import { useToast } from "@/hooks/use-toast"
import type { Order } from "@/lib/types"

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = params.id as string
    OrderService.get(id).then((res) => {
      if (res.data?.order) {
        setOrder(res.data.order)
      }
      setLoading(false)
    })
  }, [params.id])

  async function handleCancel() {
    if (!order) return
    const res = await OrderService.cancel(order.id)
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }
    toast({ title: "Success", description: "Order cancelled" })
    if (res.data?.order) {
      setOrder(res.data.order)
    }
  }

  async function handleReturn() {
    if (!order) return
    const res = await OrderService.return(order.id)
    if (res.error) {
      toast({ title: "Error", description: res.error.message, variant: "destructive" })
      return
    }
    toast({ title: "Success", description: "Return request submitted" })
    if (res.data?.order) {
      setOrder(res.data.order)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Loading...</h1>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Order not found</h1>
        <Button onClick={() => router.push("/orders")} className="mt-4">
          Back to orders
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <Button variant="ghost" onClick={() => router.push("/orders")} className="mb-4">
        ← Back to orders
      </Button>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl">Order #{order.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">
              Placed on {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}
            </p>
          </div>
          <Badge
            variant={
              order.status === "delivered" ? "default" : order.status === "cancelled" ? "destructive" : "secondary"
            }
          >
            {order.status}
          </Badge>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h2 className="font-semibold">Items</h2>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between">
              <div>
                <p className="font-medium">{item.name || `Product ${item.productId.slice(0, 8)}`}</p>
                <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
              </div>
              <p className="font-medium">${((item.price || 0) * item.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <Separator className="my-6" />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>${order.subtotal?.toFixed(2) || "0.00"}</span>
          </div>
          {order.discount && order.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-${order.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${order.total?.toFixed(2) || "0.00"}</span>
          </div>
        </div>

        {order.address && (
          <>
            <Separator className="my-6" />
            <div>
              <h2 className="mb-2 font-semibold">Shipping address</h2>
              <p className="text-sm text-muted-foreground">
                {order.address.line1}
                {order.address.line2 && `, ${order.address.line2}`}
                <br />
                {order.address.city}, {order.address.state} {order.address.postalCode}
                <br />
                {order.address.country}
              </p>
            </div>
          </>
        )}

        {order.status === "pending" && (
          <div className="mt-6 flex gap-2">
            <Button variant="destructive" onClick={handleCancel}>
              Cancel order
            </Button>
          </div>
        )}

        {order.status === "delivered" && (
          <div className="mt-6">
            <Button variant="outline" onClick={handleReturn}>
              Request return
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
