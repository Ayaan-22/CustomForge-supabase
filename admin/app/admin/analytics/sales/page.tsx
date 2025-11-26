"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";

export default function SalesAnalyticsPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("30d");
  const [grouping, setGrouping] = useState("daily");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const daysMap: Record<string, number> = {
          "7d": 7,
          "30d": 30,
          "90d": 90,
          "1y": 365,
        };
        const days = daysMap[period] || 30;

        const response = await apiClient.getSalesAnalytics(days, grouping);
        // Handle unwrapped data
        const analyticsData = response.data || response;
        setData(analyticsData);
      } catch (error) {
        console.error("Failed to fetch sales analytics:", error);
        toast({
          title: "Error",
          description: "Failed to fetch sales analytics",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period, grouping]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!data) return null;

  // Map API response to chart data
  // API returns salesByPeriod: [{ period: "2024-01-01", sales: 100, orders: 5 }, ...]
  // We need to ensure it matches what Recharts expects.
  const chartData = data.salesByPeriod || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Sales Analytics</h1>
        <p className="text-[#A0A0A8] mt-1">
          Track your sales performance and trends
        </p>
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
                className={
                  period === p
                    ? "bg-gradient-to-r from-[#7C3AED] to-[#3B82F6]"
                    : ""
                }
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[#A0A0A8] text-sm font-medium mb-2">Grouping</p>
          <div className="flex gap-2">
            {["daily", "weekly", "monthly"].map((g) => (
              <Button
                key={g}
                variant={grouping === g ? "default" : "outline"}
                onClick={() => setGrouping(g)}
                className={
                  grouping === g
                    ? "bg-gradient-to-r from-[#7C3AED] to-[#3B82F6]"
                    : ""
                }
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
          <p className="text-2xl font-bold text-white mt-2">
            $
            {(data.totalSales || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          {/* Growth stats would require previous period comparison, which API might not provide yet */}
          {/* <p className="text-green-500 text-sm mt-2">+12.5% vs last period</p> */}
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Orders</p>
          <p className="text-2xl font-bold text-white mt-2">
            {(data.totalOrders || 0).toLocaleString()}
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Avg Order Value</p>
          <p className="text-2xl font-bold text-white mt-2">
            $
            {(data.avgOrderValue || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">New Customers</p>
          <p className="text-2xl font-bold text-white mt-2">
            {(data.customerStats?.newCustomers || 0).toLocaleString()}
          </p>
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
              <XAxis dataKey="period" stroke="#A0A0A8" />
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
                dataKey="sales"
                name="Revenue"
                stroke="#7C3AED"
                strokeWidth={2}
                dot={{ fill: "#7C3AED" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Orders Chart */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Orders Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" />
              <XAxis dataKey="period" stroke="#A0A0A8" />
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
              <Bar
                dataKey="orders"
                name="Orders"
                fill="#3B82F6"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Products */}
      <Card className="glass-dark p-6 border-[#2A2A35]">
        <h3 className="text-white font-semibold mb-4">Top Selling Products</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data.topProducts || []}
            layout="vertical"
            margin={{ left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" />
            <XAxis type="number" stroke="#A0A0A8" />
            <YAxis
              dataKey="name"
              type="category"
              stroke="#A0A0A8"
              width={150}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F1F28",
                border: "1px solid #2A2A35",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#F5F5F7" }}
            />
            <Legend />
            <Bar
              dataKey="sales"
              name="Sales Count"
              fill="#7C3AED"
              radius={[0, 8, 8, 0]}
            />
            <Bar
              dataKey="revenue"
              name="Revenue"
              fill="#3B82F6"
              radius={[0, 8, 8, 0]}
            />
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
              <span className="text-white font-semibold">
                {(data.customerStats?.totalCustomers || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#A0A0A8]">New Customers</span>
              <span className="text-white font-semibold">
                {(data.customerStats?.newCustomers || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#A0A0A8]">Repeat Customers</span>
              <span className="text-white font-semibold">
                {(data.customerStats?.repeatCustomers || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-[#2A2A35]">
              <span className="text-[#A0A0A8]">Repeat Rate</span>
              <span className="text-white font-semibold">
                {data.customerStats?.totalCustomers > 0
                  ? (
                      (data.customerStats.repeatCustomers /
                        data.customerStats.totalCustomers) *
                      100
                    ).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </Card>

        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Performance Summary</h3>
          <div className="space-y-4">
            <div className="p-3 bg-green-500/10 rounded border border-green-500/20">
              <p className="text-green-400 text-sm font-medium">
                Revenue Growth
              </p>
              <p className="text-white text-lg font-bold mt-1">
                {/* Placeholder for growth if API doesn't provide it */}
                {data.growth
                  ? `${data.growth > 0 ? "+" : ""}${data.growth}%`
                  : "N/A"}
              </p>
            </div>
            {/* Add more summary cards if data available */}
          </div>
        </Card>
      </div>
    </div>
  );
}
