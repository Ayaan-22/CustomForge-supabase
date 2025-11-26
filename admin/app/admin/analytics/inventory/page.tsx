"use client"

import { Card } from "@/components/ui/card"
import { AlertCircle, TrendingUp } from "lucide-react"
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
} from "recharts"

const mockInventoryData = {
  stockLevels: {
    totalStock: 15234,
    avgStock: 45,
    outOfStock: 5,
    lowStock: 28,
    inStock: 309,
  },
  categoryStock: [
    { category: "CPU", totalStock: 2345, productCount: 45, avgStock: 52, lowStockCount: 3 },
    { category: "GPU", totalStock: 3456, productCount: 38, avgStock: 91, lowStockCount: 5 },
    { category: "Motherboard", totalStock: 1234, productCount: 28, avgStock: 44, lowStockCount: 2 },
    { category: "RAM", totalStock: 2890, productCount: 52, avgStock: 56, lowStockCount: 4 },
    { category: "Storage", totalStock: 3210, productCount: 35, avgStock: 92, lowStockCount: 6 },
    { category: "Monitor", totalStock: 1899, productCount: 22, avgStock: 86, lowStockCount: 3 },
  ],
  lowStockProducts: [
    { name: "RTX 4090", category: "GPU", stock: 3, sku: "RTX-4090-001" },
    { name: "Ryzen 9 7950X", category: "CPU", stock: 5, sku: "CPU-R9-001" },
    { name: "ASUS ROG Strix", category: "Motherboard", stock: 2, sku: "MB-ASUS-001" },
    { name: "Corsair Vengeance", category: "RAM", stock: 8, sku: "RAM-CORS-001" },
    { name: "Samsung 990 Pro", category: "Storage", stock: 4, sku: "SSD-SAM-001" },
  ],
  topSellingProducts: [
    { name: "RTX 4070", category: "GPU", salesCount: 456, stock: 45 },
    { name: "Ryzen 7 7700X", category: "CPU", salesCount: 389, stock: 67 },
    { name: "ASUS TUF Monitor", category: "Monitor", salesCount: 234, stock: 23 },
    { name: "Corsair K95", category: "Keyboard", salesCount: 198, stock: 89 },
    { name: "WD Black SN850X", category: "Storage", salesCount: 167, stock: 45 },
  ],
  stockDistribution: [
    { name: "In Stock (>10)", value: 309, color: "#10B981" },
    { name: "Low Stock (1-10)", value: 28, color: "#F59E0B" },
    { name: "Out of Stock", value: 5, color: "#EF4444" },
  ],
}

export default function InventoryAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Inventory Analytics</h1>
        <p className="text-[#A0A0A8] mt-1">Monitor stock levels and inventory health</p>
      </div>

      {/* Stock Level Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Stock</p>
          <p className="text-2xl font-bold text-white mt-2">{mockInventoryData.stockLevels.totalStock}</p>
          <p className="text-[#A0A0A8] text-xs mt-2">units</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Avg Stock</p>
          <p className="text-2xl font-bold text-white mt-2">{mockInventoryData.stockLevels.avgStock}</p>
          <p className="text-[#A0A0A8] text-xs mt-2">per product</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">In Stock</p>
          <p className="text-2xl font-bold text-green-400 mt-2">{mockInventoryData.stockLevels.inStock}</p>
          <p className="text-[#A0A0A8] text-xs mt-2">products</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-400 mt-2">{mockInventoryData.stockLevels.lowStock}</p>
          <p className="text-[#A0A0A8] text-xs mt-2">products</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Out of Stock</p>
          <p className="text-2xl font-bold text-red-400 mt-2">{mockInventoryData.stockLevels.outOfStock}</p>
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
                data={mockInventoryData.stockDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {mockInventoryData.stockDistribution.map((entry, index) => (
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
            <BarChart data={mockInventoryData.categoryStock}>
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
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Product Name</th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Category</th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">SKU</th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {mockInventoryData.lowStockProducts.map((product, i) => (
                <tr key={i} className="border-b border-[#2A2A35] hover:bg-[#1F1F28] transition-colors">
                  <td className="py-3 px-4 text-white">{product.name}</td>
                  <td className="py-3 px-4 text-[#A0A0A8]">{product.category}</td>
                  <td className="py-3 px-4 text-[#A0A0A8]">{product.sku}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                      {product.stock} units
                    </span>
                  </td>
                </tr>
              ))}
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
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Product Name</th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Category</th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Sales Count</th>
                <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Current Stock</th>
              </tr>
            </thead>
            <tbody>
              {mockInventoryData.topSellingProducts.map((product, i) => (
                <tr key={i} className="border-b border-[#2A2A35] hover:bg-[#1F1F28] transition-colors">
                  <td className="py-3 px-4 text-white">{product.name}</td>
                  <td className="py-3 px-4 text-[#A0A0A8]">{product.category}</td>
                  <td className="py-3 px-4 text-white font-medium">{product.salesCount}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
