"use client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  AlertCircle,
} from "lucide-react";
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
} from "recharts";
import { apiClient } from "@/lib/api-client";

export function DashboardOverview() {
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [overview, sales, users, orders, products, inventory] =
          await Promise.all([
            apiClient.getDashboardOverview(period),
            apiClient.getSalesAnalytics(period),
            apiClient.getUserAnalytics(period),
            apiClient.getOrderAnalytics(period),
            apiClient.getProductStats(),
            apiClient.getInventoryAnalytics(),
          ]);

        setData({
          metrics: [
            {
              label: "Total Revenue",
              value: `$${sales.totalRevenue.toLocaleString()}`,
              change: `${sales.growth}%`,
              positive: sales.growth >= 0,
              icon: "revenue",
            },
            {
              label: "Total Orders",
              value: orders.totalOrders.toLocaleString(),
              change: `${orders.growth}%`,
              positive: orders.growth >= 0,
              icon: "orders",
            },
            {
              label: "Active Users",
              value: users.activeUsers.toLocaleString(),
              change: `${users.growth}%`,
              positive: users.growth >= 0,
              icon: "users",
            },
            {
              label: "Active Products",
              value: products.activeProducts.toLocaleString(),
              change: `${products.growth}%`,
              positive: products.growth >= 0,
              icon: "products",
            },
          ],
          revenueData: sales.revenueData,
          ordersData: orders.ordersData,
          productStats: [
            {
              label: "Total Products",
              value: products.totalProducts.toString(),
              subtext: "Active",
            },
            {
              label: "Low Stock",
              value: products.lowStock.toString(),
              subtext: "Alert",
              color: "warning",
            },
            {
              label: "Out of Stock",
              value: products.outOfStock.toString(),
              subtext: "Critical",
              color: "danger",
            },
          ],
          userStats: [
            { label: "Total Users", value: users.totalUsers.toLocaleString() },
            {
              label: "Active Users",
              value: users.activeUsers.toLocaleString(),
            },
            { label: "New Users", value: users.newUsers.toLocaleString() },
          ],
          recentOrders: orders.recentOrders,
          alerts: [
            {
              type: "warning",
              message: `${products.lowStock} products low on stock`,
            },
            {
              type: "danger",
              message: `${products.outOfStock} products out of stock`,
            },
            { type: "info", message: `${users.newUsers} new users this month` },
          ],
        });
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96 text-red-400">
        {error || "No data available"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex gap-2">
        {["7d", "30d", "90d", "1y"].map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            onClick={() => setPeriod(p)}
            className={
              period === p ? "bg-linear-to-r from-[#7C3AED] to-[#3B82F6]" : ""
            }
          >
            {p}
          </Button>
        ))}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.metrics.map((metric: any, idx: number) => (
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
              <span
                className={metric.positive ? "text-green-500" : "text-red-500"}
              >
                {metric.change}
              </span>
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
            <LineChart data={data.revenueData}>
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
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#7C3AED"
                strokeWidth={2}
                dot={{ fill: "#7C3AED" }}
              />
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
            <BarChart data={data.ordersData}>
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
            {data.productStats.map((stat: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-[#A0A0A8] text-sm">{stat.label}</span>
                <div className="flex flex-col items-end">
                  <span className="text-white font-semibold">{stat.value}</span>
                  <span
                    className={`text-xs ${
                      stat.color === "warning"
                        ? "text-yellow-500"
                        : stat.color === "danger"
                        ? "text-red-500"
                        : "text-green-500"
                    }`}
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
            {data.userStats.map((stat: any, idx: number) => (
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
            {data.alerts.map((alert: any, idx: number) => (
              <div
                key={idx}
                className={`p-2 rounded border ${
                  alert.type === "warning"
                    ? "bg-yellow-500/10 border-yellow-500/20"
                    : alert.type === "danger"
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-blue-500/10 border-blue-500/20"
                }`}
              >
                <p
                  className={
                    alert.type === "warning"
                      ? "text-yellow-400"
                      : alert.type === "danger"
                      ? "text-red-400"
                      : "text-blue-400"
                  }
                >
                  {alert.message}
                </p>
              </div>
            ))}
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
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Order ID
                </th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Customer
                </th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Amount
                </th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order: any, i: number) => (
                <tr
                  key={i}
                  className="border-b border-[#2A2A35] hover:bg-[#1F1F28] transition-colors"
                >
                  <td className="py-3 px-4 text-white font-medium">
                    {order.id}
                  </td>
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
  );
}
