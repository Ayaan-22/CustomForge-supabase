"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Users, Package, AlertCircle } from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const mockData = {
  periods: ["7d", "30d", "90d", "1y"],
  metrics: [
    { label: "Total Revenue", value: "$45,231.89", change: "+12.5%", positive: true, icon: "revenue" },
    { label: "Total Orders", value: "1,234", change: "+8.2%", positive: true, icon: "orders" },
    { label: "Active Users", value: "5,678", change: "+15.3%", positive: true, icon: "users" },
    { label: "Active Products", value: "342", change: "+4.3%", positive: true, icon: "products" },
  ],
  revenueData: [
    { date: "Jan 1", revenue: 4000, avgOrderValue: 156 },
    { date: "Jan 2", revenue: 3000, avgOrderValue: 145 },
    { date: "Jan 3", revenue: 2000, avgOrderValue: 132 },
    { date: "Jan 4", revenue: 2780, avgOrderValue: 148 },
    { date: "Jan 5", revenue: 1890, avgOrderValue: 125 },
    { date: "Jan 6", revenue: 2390, avgOrderValue: 140 },
    { date: "Jan 7", revenue: 3490, avgOrderValue: 165 },
  ],
  ordersData: [
    { date: "Jan 1", orders: 45, delivered: 42 },
    { date: "Jan 2", orders: 38, delivered: 35 },
    { date: "Jan 3", orders: 28, delivered: 26 },
    { date: "Jan 4", orders: 42, delivered: 40 },
    { date: "Jan 5", orders: 32, delivered: 30 },
    { date: "Jan 6", orders: 35, delivered: 33 },
    { date: "Jan 7", orders: 48, delivered: 46 },
  ],
  productStats: [
    { label: "Total Products", value: "342", subtext: "Active" },
    { label: "Low Stock", value: "28", subtext: "Alert", color: "warning" },
    { label: "Out of Stock", value: "5", subtext: "Critical", color: "danger" },
  ],
  userStats: [
    { label: "Total Users", value: "8,234" },
    { label: "Active Users", value: "5,678" },
    { label: "New Users", value: "342" },
  ],
  recentOrders: [
    { id: "#ORD-1001", customer: "John Doe", amount: "$1,234.56", status: "Delivered" },
    { id: "#ORD-1002", customer: "Jane Smith", amount: "$856.32", status: "Processing" },
    { id: "#ORD-1003", customer: "Bob Johnson", amount: "$2,145.78", status: "Shipped" },
    { id: "#ORD-1004", customer: "Alice Brown", amount: "$567.89", status: "Delivered" },
    { id: "#ORD-1005", customer: "Charlie Wilson", amount: "$1,890.45", status: "Pending" },
  ],
}

export function DashboardOverview() {
  const [period, setPeriod] = useState("30d")

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex gap-2">
        {mockData.periods.map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            onClick={() => setPeriod(p)}
            className={period === p ? "bg-gradient-to-r from-[#7C3AED] to-[#3B82F6]" : ""}
          >
            {p}
          </Button>
        ))}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockData.metrics.map((metric, idx) => (
          <Card
            key={idx}
            className="glass-dark p-6 border-[#2A2A35] hover:border-[#7C3AED]/50 transition-all duration-300"
          >
            <p className="text-[#A0A0A8] text-sm font-medium">{metric.label}</p>
            <p className="text-2xl font-bold text-white mt-2">{metric.value}</p>
            <div className="flex items-center gap-1 mt-3">
              {metric.positive ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={metric.positive ? "text-green-500" : "text-red-500"}>{metric.change}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockData.revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" />
              <XAxis dataKey="date" stroke="#A0A0A8" />
              <YAxis stroke="#A0A0A8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F1F28",
                  border: "1px solid #2A2A35",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#F5F5F7" }}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2} dot={{ fill: "#7C3AED" }} />
              <Line
                type="monotone"
                dataKey="avgOrderValue"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: "#3B82F6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Orders Chart */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Orders per Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockData.ordersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" />
              <XAxis dataKey="date" stroke="#A0A0A8" />
              <YAxis stroke="#A0A0A8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F1F28",
                  border: "1px solid #2A2A35",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#F5F5F7" }}
              />
              <Legend />
              <Bar dataKey="orders" fill="#7C3AED" radius={[8, 8, 0, 0]} />
              <Bar dataKey="delivered" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Product Stats */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#7C3AED]" />
            Product Status
          </h3>
          <div className="space-y-3">
            {mockData.productStats.map((stat, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-[#A0A0A8] text-sm">{stat.label}</span>
                <div className="flex flex-col items-end">
                  <span className="text-white font-semibold">{stat.value}</span>
                  <span
                    className={`text-xs ${stat.color === "warning" ? "text-yellow-500" : stat.color === "danger" ? "text-red-500" : "text-green-500"}`}
                  >
                    {stat.subtext}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* User Stats */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#3B82F6]" />
            User Statistics
          </h3>
          <div className="space-y-3">
            {mockData.userStats.map((stat, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-[#A0A0A8] text-sm">{stat.label}</span>
                <span className="text-white font-semibold">{stat.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            Quick Alerts
          </h3>
          <div className="space-y-2 text-sm">
            <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
              <p className="text-yellow-400">28 products low on stock</p>
            </div>
            <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
              <p className="text-red-400">5 products out of stock</p>
            </div>
            <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
              <p className="text-blue-400">342 new users this month</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="glass-dark p-6 border-[#2A2A35]">
        <h3 className="text-white font-semibold mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A35]">
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Order ID</th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Customer</th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Amount</th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockData.recentOrders.map((order, i) => (
                <tr key={i} className="border-b border-[#2A2A35] hover:bg-[#1F1F28] transition-colors">
                  <td className="py-3 px-4 text-white font-medium">{order.id}</td>
                  <td className="py-3 px-4 text-white">{order.customer}</td>
                  <td className="py-3 px-4 text-white">{order.amount}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === "Delivered"
                          ? "bg-green-500/20 text-green-400"
                          : order.status === "Shipped"
                            ? "bg-blue-500/20 text-blue-400"
                            : order.status === "Processing"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
