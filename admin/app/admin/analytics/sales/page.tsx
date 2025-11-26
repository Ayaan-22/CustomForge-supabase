"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

const mockSalesData = {
  daily: [
    { date: "Jan 1", revenue: 4000, orders: 45, avgOrderValue: 156 },
    { date: "Jan 2", revenue: 3000, orders: 38, avgOrderValue: 145 },
    { date: "Jan 3", revenue: 2000, orders: 28, avgOrderValue: 132 },
    { date: "Jan 4", revenue: 2780, orders: 42, avgOrderValue: 148 },
    { date: "Jan 5", revenue: 1890, orders: 32, avgOrderValue: 125 },
    { date: "Jan 6", revenue: 2390, orders: 35, avgOrderValue: 140 },
    { date: "Jan 7", revenue: 3490, orders: 48, avgOrderValue: 165 },
  ],
  weekly: [
    { week: "Week 1", revenue: 19160, orders: 268, avgOrderValue: 145 },
    { week: "Week 2", revenue: 18450, orders: 245, avgOrderValue: 152 },
    { week: "Week 3", revenue: 21340, orders: 289, avgOrderValue: 158 },
    { week: "Week 4", revenue: 19890, orders: 267, avgOrderValue: 148 },
  ],
  topProducts: [
    { name: "RTX 4090", sales: 4500, revenue: 45000 },
    { name: "Ryzen 9 7950X", sales: 3800, revenue: 38000 },
    { name: "ASUS ROG Monitor", sales: 3200, revenue: 32000 },
    { name: "Corsair K95", sales: 2900, revenue: 14500 },
    { name: "Samsung 990 Pro", sales: 2600, revenue: 26000 },
  ],
  customerStats: {
    totalCustomers: 5678,
    newCustomers: 342,
    repeatCustomers: 4156,
    avgOrderValue: 156.78,
  },
}

export default function SalesAnalyticsPage() {
  const [period, setPeriod] = useState("30d")
  const [grouping, setGrouping] = useState("daily")

  const chartData = grouping === "daily" ? mockSalesData.daily : mockSalesData.weekly

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Sales Analytics</h1>
        <p className="text-[#A0A0A8] mt-1">Track your sales performance and trends</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[#A0A0A8] text-sm font-medium mb-2">Time Period</p>
          <div className="flex gap-2">
            {["7d", "30d", "90d", "1y"].map((p) => (
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
        </div>

        <div>
          <p className="text-[#A0A0A8] text-sm font-medium mb-2">Grouping</p>
          <div className="flex gap-2">
            {["daily", "weekly"].map((g) => (
              <Button
                key={g}
                variant={grouping === g ? "default" : "outline"}
                onClick={() => setGrouping(g)}
                className={grouping === g ? "bg-gradient-to-r from-[#7C3AED] to-[#3B82F6]" : ""}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Revenue</p>
          <p className="text-2xl font-bold text-white mt-2">$45,231.89</p>
          <p className="text-green-500 text-sm mt-2">+12.5% vs last period</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Orders</p>
          <p className="text-2xl font-bold text-white mt-2">1,234</p>
          <p className="text-green-500 text-sm mt-2">+8.2% vs last period</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Avg Order Value</p>
          <p className="text-2xl font-bold text-white mt-2">${mockSalesData.customerStats.avgOrderValue}</p>
          <p className="text-green-500 text-sm mt-2">+3.2% vs last period</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">New Customers</p>
          <p className="text-2xl font-bold text-white mt-2">{mockSalesData.customerStats.newCustomers}</p>
          <p className="text-green-500 text-sm mt-2">+15.3% vs last period</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Revenue Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" />
              <XAxis dataKey={grouping === "daily" ? "date" : "week"} stroke="#A0A0A8" />
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
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Orders Chart */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Orders Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" />
              <XAxis dataKey={grouping === "daily" ? "date" : "week"} stroke="#A0A0A8" />
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
              <Bar dataKey="orders" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Products */}
      <Card className="glass-dark p-6 border-[#2A2A35]">
        <h3 className="text-white font-semibold mb-4">Top Selling Products</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={mockSalesData.topProducts} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" />
            <XAxis type="number" stroke="#A0A0A8" />
            <YAxis dataKey="name" type="category" stroke="#A0A0A8" width={150} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F1F28",
                border: "1px solid #2A2A35",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#F5F5F7" }}
            />
            <Legend />
            <Bar dataKey="sales" fill="#7C3AED" radius={[0, 8, 8, 0]} />
            <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Customer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Customer Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[#A0A0A8]">Total Customers</span>
              <span className="text-white font-semibold">{mockSalesData.customerStats.totalCustomers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#A0A0A8]">New Customers</span>
              <span className="text-white font-semibold">{mockSalesData.customerStats.newCustomers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#A0A0A8]">Repeat Customers</span>
              <span className="text-white font-semibold">{mockSalesData.customerStats.repeatCustomers}</span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-[#2A2A35]">
              <span className="text-[#A0A0A8]">Repeat Rate</span>
              <span className="text-white font-semibold">
                {(
                  (mockSalesData.customerStats.repeatCustomers / mockSalesData.customerStats.totalCustomers) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
        </Card>

        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Performance Summary</h3>
          <div className="space-y-4">
            <div className="p-3 bg-green-500/10 rounded border border-green-500/20">
              <p className="text-green-400 text-sm font-medium">Revenue Growth</p>
              <p className="text-white text-lg font-bold mt-1">+12.5%</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded border border-blue-500/20">
              <p className="text-blue-400 text-sm font-medium">Order Growth</p>
              <p className="text-white text-lg font-bold mt-1">+8.2%</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded border border-purple-500/20">
              <p className="text-purple-400 text-sm font-medium">Customer Growth</p>
              <p className="text-white text-lg font-bold mt-1">+15.3%</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
