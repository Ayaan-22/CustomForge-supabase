"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserService } from "@/services/user-service"
import type { Order } from "@/lib/types"

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    UserService.orders().then((res) => {
      if (res.data?.items) {
        setOrders(res.data.items)
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading text-2xl">Loading orders...</h1>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h1 className="font-heading mb-4 text-2xl">No orders yet</h1>
        <p className="mb-6 text-muted-foreground">Start shopping to see your orders here</p>
        <Link href="/products">
          <Button>Browse products</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-heading mb-6 text-2xl">My orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">
                  {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <div className="text-right">
                <Badge
                  variant={
                    order.status === "delivered"
                      ? "default"
                      : order.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {order.status}
                </Badge>
                <p className="mt-2 font-semibold">${order.total?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href={`/orders/${order.id}`}>
                <Button variant="outline" size="sm">
                  View details
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
