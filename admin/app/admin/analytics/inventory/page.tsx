"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AlertCircle, TrendingUp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
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

export default function InventoryAnalyticsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await apiClient.getInventoryAnalytics();
        // Unwrap data if needed (apiClient usually unwraps .data, but let's be safe)
        // Based on my controller update: res.json({ success: true, data: { ... } })
        // apiClient.getInventoryAnalytics returns response.json().then(res => res.data)
        // So we get the inner data object directly.
        setData(response);
      } catch (error) {
        console.error("Failed to fetch inventory analytics:", error);
        toast({
          title: "Error",
          description: "Failed to fetch inventory analytics",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!data) return null;

  const stockDistribution = [
    {
      name: "In Stock",
      value: data.stockLevels?.inStock || 0,
      color: "#10B981",
    },
    {
      name: "Low Stock",
      value: data.stockLevels?.lowStock || 0,
      color: "#F59E0B",
    },
    {
      name: "Out of Stock",
      value: data.stockLevels?.outOfStock || 0,
      color: "#EF4444",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Inventory Analytics</h1>
        <p className="text-[#A0A0A8] mt-1">
          Monitor stock levels and inventory health
        </p>
      </div>

      {/* Stock Level Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Stock</p>
          <p className="text-2xl font-bold text-white mt-2">
            {data.stockLevels?.totalStock || 0}
          </p>
          <p className="text-[#A0A0A8] text-xs mt-2">units</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Avg Stock</p>
          <p className="text-2xl font-bold text-white mt-2">
            {data.stockLevels?.avgStock || 0}
          </p>
          <p className="text-[#A0A0A8] text-xs mt-2">per product</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">In Stock</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {data.stockLevels?.inStock || 0}
          </p>
          <p className="text-[#A0A0A8] text-xs mt-2">products</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-400 mt-2">
            {data.stockLevels?.lowStock || 0}
          </p>
          <p className="text-[#A0A0A8] text-xs mt-2">products</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Out of Stock</p>
          <p className="text-2xl font-bold text-red-400 mt-2">
            {data.stockLevels?.outOfStock || 0}
          </p>
          <p className="text-[#A0A0A8] text-xs mt-2">products</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Distribution */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Stock Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stockDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {stockDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F1F28",
                  border: "1px solid #2A2A35",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#F5F5F7" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Category Stock */}
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <h3 className="text-white font-semibold mb-4">Stock by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.categoryStock || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" />
              <XAxis dataKey="category" stroke="#A0A0A8" />
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
              <Bar dataKey="totalStock" fill="#7C3AED" radius={[8, 8, 0, 0]} />
              <Bar dataKey="avgStock" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Low Stock Alert */}
      <Card className="glass-dark p-6 border-[#2A2A35]">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          Low Stock Products
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A35]">
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Product Name
                </th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Category
                </th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  SKU
                </th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Stock
                </th>
              </tr>
            </thead>
            <tbody>
              {(data.lowStockProducts || []).map((product: any, i: number) => (
                <tr
                  key={i}
                  className="border-b border-[#2A2A35] hover:bg-[#1F1F28] transition-colors"
                >
                  <td className="py-3 px-4 text-white">{product.name}</td>
                  <td className="py-3 px-4 text-[#A0A0A8]">
                    {product.category || "N/A"}
                  </td>
                  <td className="py-3 px-4 text-[#A0A0A8]">
                    {product.sku || "N/A"}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                      {product.stock} units
                    </span>
                  </td>
                </tr>
              ))}
              {(data.lowStockProducts || []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-[#A0A0A8]">
                    No low stock products
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top Selling Products */}
      <Card className="glass-dark p-6 border-[#2A2A35]">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Top Selling Products
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A35]">
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Product Name
                </th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Category
                </th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Sales Count
                </th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">
                  Current Stock
                </th>
              </tr>
            </thead>
            <tbody>
              {(data.topSellingProducts || []).map(
                (product: any, i: number) => (
                  <tr
                    key={i}
                    className="border-b border-[#2A2A35] hover:bg-[#1F1F28] transition-colors"
                  >
                    <td className="py-3 px-4 text-white">{product.name}</td>
                    <td className="py-3 px-4 text-[#A0A0A8]">
                      {product.category || "N/A"}
                    </td>
                    <td className="py-3 px-4 text-white font-medium">
                      {product.sales_count}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.stock > 50
                            ? "bg-green-500/20 text-green-400"
                            : product.stock > 20
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {product.stock} units
                      </span>
                    </td>
                  </tr>
                )
              )}
              {(data.topSellingProducts || []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-[#A0A0A8]">
                    No top selling products yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
