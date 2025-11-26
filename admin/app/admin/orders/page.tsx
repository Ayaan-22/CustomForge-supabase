"use client"

import type React from "react"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, Package, Truck, RotateCcw, CreditCard, MapPin } from "lucide-react"

const mockOrders = [
  {
    id: "507f1f77bcf86cd799439011",
    user_id: "507f1f77bcf86cd799439001",
    order_items: [
      {
        id: "item001",
        product_id: "507f1f77bcf86cd799439011",
        name: "RTX 4090 Graphics Card",
        image: "https://images.unsplash.com/photo-1587829191301-4b13aaf5a52f?w=80",
        price: 1599.99,
        quantity: 1,
        price_snapshot: 1599.99,
      },
    ],
    shipping_address: {
      full_name: "John Doe",
      address: "123 Main Street",
      city: "San Francisco",
      state: "CA",
      postal_code: "94102",
      country: "United States",
    },
    payment_method: "stripe",
    payment_result: {
      id: "pi_1234567890",
      status: "succeeded",
    },
    items_price: 1599.99,
    discount_amount: 0,
    shipping_price: 25.0,
    tax_price: 184.0,
    total_price: 1808.99,
    coupon_applied: null,
    is_paid: true,
    paid_at: "2024-01-15T10:30:00Z",
    is_delivered: true,
    delivered_at: "2024-01-18T14:20:00Z",
    status: "delivered",
    notes: "Delivered successfully",
    return_status: "none",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-18T14:20:00Z",
  },
  {
    id: "507f1f77bcf86cd799439012",
    user_id: "507f1f77bcf86cd799439002",
    order_items: [
      {
        id: "item002",
        product_id: "507f1f77bcf86cd799439012",
        name: "Intel Core i9-14900K",
        image: "https://images.unsplash.com/photo-1591290621749-2127ba37f058?w=80",
        price: 699.99,
        quantity: 1,
        price_snapshot: 699.99,
      },
    ],
    shipping_address: {
      full_name: "Jane Smith",
      address: "456 Oak Avenue",
      city: "New York",
      state: "NY",
      postal_code: "10001",
      country: "United States",
    },
    payment_method: "stripe",
    payment_result: {
      id: "pi_0987654321",
      status: "succeeded",
    },
    items_price: 699.99,
    discount_amount: 0,
    shipping_price: 15.0,
    tax_price: 57.6,
    total_price: 772.59,
    coupon_applied: null,
    is_paid: true,
    paid_at: "2024-01-14T15:45:00Z",
    is_delivered: false,
    delivered_at: null,
    status: "shipped",
    notes: "In transit",
    return_status: "none",
    created_at: "2024-01-14T15:00:00Z",
    updated_at: "2024-01-16T08:30:00Z",
  },
]

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  processing: "bg-blue-500/20 text-blue-400",
  shipped: "bg-cyan-500/20 text-cyan-400",
  delivered: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
  refunded: "bg-purple-500/20 text-purple-400",
  returned: "bg-pink-500/20 text-pink-400",
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Package className="w-4 h-4" />,
  processing: <Package className="w-4 h-4" />,
  shipped: <Truck className="w-4 h-4" />,
  delivered: <Truck className="w-4 h-4" />,
  cancelled: <RotateCcw className="w-4 h-4" />,
  refunded: <RotateCcw className="w-4 h-4" />,
  returned: <RotateCcw className="w-4 h-4" />,
}

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shipping_address.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statuses = ["all", ...new Set(mockOrders.map((o) => o.status))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Orders</h1>
          <p className="text-[#A0A0A8] mt-1">Manage customer orders and shipments</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search by order ID or customer name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-[#1F1F28] border-[#2A2A35] text-white placeholder:text-[#A0A0A8]"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All Status" : status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
      <Card className="glass-dark p-6 border-[#2A2A35]">
        <div className="space-y-2">
          {filteredOrders.map((order) => (
            <div key={order.id}>
              <button
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-[#1F1F28] rounded-lg transition-colors border border-[#2A2A35]"
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div>
                    <p className="text-white font-medium">{order.id}</p>
                    <p className="text-[#A0A0A8] text-sm">{order.shipping_address.full_name}</p>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-8">
                  <div>
                    <p className="text-white font-medium">${order.total_price.toFixed(2)}</p>
                    <p className="text-[#A0A0A8] text-sm">{order.order_items.length} items</p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[order.status]}`}
                  >
                    {statusIcons[order.status]}
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>

                  <p className="text-[#A0A0A8] text-sm w-24">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>

                <ChevronDown
                  className={`w-5 h-5 text-[#A0A0A8] transition-transform ${expandedOrder === order.id ? "rotate-180" : ""}`}
                />
              </button>

              {/* Expanded Details */}
              {expandedOrder === order.id && (
                <div className="bg-[#1F1F28] p-6 rounded-lg border border-[#2A2A35] space-y-6">
                  {/* Order Items */}
                  <div>
                    <h3 className="text-white font-semibold mb-3">Order Items</h3>
                    <div className="space-y-2">
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-[#0F0F14] rounded">
                          <img
                            src={item.image || "/placeholder.svg"}
                            alt={item.name}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">{item.name}</p>
                            <p className="text-[#A0A0A8] text-xs">
                              {item.quantity}x ${item.price.toFixed(2)}
                            </p>
                          </div>
                          <p className="text-white font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="border-t border-[#2A2A35] pt-4">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Shipping Address
                    </h3>
                    <div className="text-[#A0A0A8] text-sm space-y-1">
                      <p className="text-white">{order.shipping_address.full_name}</p>
                      <p>{order.shipping_address.address}</p>
                      <p>
                        {order.shipping_address.city}, {order.shipping_address.state}{" "}
                        {order.shipping_address.postal_code}
                      </p>
                      <p>{order.shipping_address.country}</p>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="border-t border-[#2A2A35] pt-4">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Payment Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[#A0A0A8]">Payment Method</p>
                        <p className="text-white capitalize">{order.payment_method}</p>
                      </div>
                      <div>
                        <p className="text-[#A0A0A8]">Payment Status</p>
                        <p className={order.is_paid ? "text-green-400" : "text-yellow-400"}>
                          {order.is_paid ? "Paid" : "Pending"}
                        </p>
                      </div>
                      {order.payment_result && (
                        <>
                          <div>
                            <p className="text-[#A0A0A8]">Transaction ID</p>
                            <p className="text-white text-xs">{order.payment_result.id}</p>
                          </div>
                          <div>
                            <p className="text-[#A0A0A8]">Transaction Status</p>
                            <p className="text-white capitalize">{order.payment_result.status}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="border-t border-[#2A2A35] pt-4">
                    <h3 className="text-white font-semibold mb-3">Pricing Breakdown</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#A0A0A8]">Items Price</span>
                        <span className="text-white">${order.items_price.toFixed(2)}</span>
                      </div>
                      {order.discount_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#A0A0A8]">Discount</span>
                          <span className="text-green-400">-${order.discount_amount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#A0A0A8]">Tax</span>
                        <span className="text-white">${order.tax_price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A0A0A8]">Shipping</span>
                        <span className="text-white">${order.shipping_price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#2A2A35] pt-2 mt-2">
                        <span className="text-white font-semibold">Total</span>
                        <span className="text-white font-semibold">${order.total_price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Status */}
                  <div className="border-t border-[#2A2A35] pt-4">
                    <h3 className="text-white font-semibold mb-3">Delivery Status</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[#A0A0A8]">Delivery Status</p>
                        <p className={order.is_delivered ? "text-green-400" : "text-yellow-400"}>
                          {order.is_delivered ? "Delivered" : "In Transit"}
                        </p>
                      </div>
                      {order.delivered_at && (
                        <div>
                          <p className="text-[#A0A0A8]">Delivered At</p>
                          <p className="text-white">{new Date(order.delivered_at).toLocaleDateString()}</p>
                        </div>
                      )}
                      {order.return_status !== "none" && (
                        <div>
                          <p className="text-[#A0A0A8]">Return Status</p>
                          <p className="text-purple-400 capitalize">{order.return_status}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t border-[#2A2A35] flex-wrap">
                    {order.status === "pending" && (
                      <Button className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                        <Package className="w-4 h-4 mr-2" />
                        Mark as Processing
                      </Button>
                    )}
                    {order.status === "processing" && (
                      <Button className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                        <Truck className="w-4 h-4 mr-2" />
                        Mark as Shipped
                      </Button>
                    )}
                    {order.status === "shipped" && (
                      <Button className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                        <Truck className="w-4 h-4 mr-2" />
                        Mark as Delivered
                      </Button>
                    )}
                    {(order.status === "delivered" || order.status === "processing") &&
                      order.return_status === "none" && (
                        <Button className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Process Return
                        </Button>
                      )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Order Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Orders</p>
          <p className="text-2xl font-bold text-white mt-2">{mockOrders.length}</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Pending</p>
          <p className="text-2xl font-bold text-yellow-400 mt-2">
            {mockOrders.filter((o) => o.status === "pending").length}
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Shipped</p>
          <p className="text-2xl font-bold text-cyan-400 mt-2">
            {mockOrders.filter((o) => o.status === "shipped").length}
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Delivered</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {mockOrders.filter((o) => o.status === "delivered").length}
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Returned</p>
          <p className="text-2xl font-bold text-purple-400 mt-2">
            {mockOrders.filter((o) => o.return_status !== "none").length}
          </p>
        </Card>
      </div>
    </div>
  )
}
