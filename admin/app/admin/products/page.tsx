"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"
import { ProductModal } from "../components/product-modal"
import { ProductDetailsModal } from "../components/product-details-modal"
import { ProductCard } from "../components/product-card"

const mockProducts = [
  {
    _id: "507f1f77bcf86cd799439011",
    name: "RTX 4090 Graphics Card",
    sku: "RTX-4090-001",
    category: "GPU",
    brand: "NVIDIA",
    originalPrice: 1599.99,
    discountPercentage: 10,
    finalPrice: 1439.99,
    stock: 15,
    availability: "In Stock",
    ratings: { average: 4.8, totalReviews: 342 },
    isActive: true,
    isFeatured: true,
    salesCount: 287,
  },
  {
    _id: "507f1f77bcf86cd799439012",
    name: "Intel Core i9-14900K",
    sku: "I9-14900K-001",
    category: "CPU",
    brand: "Intel",
    originalPrice: 699.99,
    discountPercentage: 5,
    finalPrice: 664.99,
    stock: 8,
    availability: "In Stock",
    ratings: { average: 4.9, totalReviews: 521 },
    isActive: true,
    isFeatured: true,
    salesCount: 412,
  },
  {
    _id: "507f1f77bcf86cd799439013",
    name: "ASUS ROG Strix Z790-E Gaming",
    sku: "MOBO-Z790-001",
    category: "Motherboard",
    brand: "ASUS",
    originalPrice: 449.99,
    discountPercentage: 15,
    finalPrice: 382.49,
    stock: 12,
    availability: "In Stock",
    ratings: { average: 4.7, totalReviews: 289 },
    isActive: true,
    isFeatured: false,
    salesCount: 156,
  },
  {
    _id: "507f1f77bcf86cd799439014",
    name: "Corsair Vengeance RGB Pro 32GB",
    sku: "RAM-32GB-001",
    category: "RAM",
    brand: "Corsair",
    originalPrice: 179.99,
    discountPercentage: 20,
    finalPrice: 143.99,
    stock: 3,
    availability: "In Stock",
    ratings: { average: 4.6, totalReviews: 198 },
    isActive: true,
    isFeatured: false,
    salesCount: 234,
  },
  {
    _id: "507f1f77bcf86cd799439015",
    name: "Samsung 990 Pro 2TB NVMe SSD",
    sku: "SSD-990-001",
    category: "Storage",
    brand: "Samsung",
    originalPrice: 249.99,
    discountPercentage: 12,
    finalPrice: 219.99,
    stock: 0,
    availability: "Out of Stock",
    ratings: { average: 4.8, totalReviews: 456 },
    isActive: true,
    isFeatured: false,
    salesCount: 678,
  },
  {
    _id: "507f1f77bcf86cd799439016",
    name: "NZXT H7 Flow RGB Case",
    sku: "CASE-H7-001",
    category: "Case",
    brand: "NZXT",
    originalPrice: 149.99,
    discountPercentage: 0,
    finalPrice: 149.99,
    stock: 22,
    availability: "In Stock",
    ratings: { average: 4.5, totalReviews: 312 },
    isActive: true,
    isFeatured: false,
    salesCount: 189,
  },
  {
    _id: "507f1f77bcf86cd799439017",
    name: "LG UltraGear 27GP850 Monitor",
    sku: "MON-27GP-001",
    category: "Monitor",
    brand: "LG",
    originalPrice: 399.99,
    discountPercentage: 25,
    finalPrice: 299.99,
    stock: 5,
    availability: "In Stock",
    ratings: { average: 4.7, totalReviews: 423 },
    isActive: true,
    isFeatured: true,
    salesCount: 345,
  },
  {
    _id: "507f1f77bcf86cd799439018",
    name: "SteelSeries Apex Pro Keyboard",
    sku: "KB-APEX-001",
    category: "Keyboard",
    brand: "SteelSeries",
    originalPrice: 229.99,
    discountPercentage: 18,
    finalPrice: 188.39,
    stock: 7,
    availability: "In Stock",
    ratings: { average: 4.8, totalReviews: 267 },
    isActive: true,
    isFeatured: false,
    salesCount: 198,
  },
]

const PRODUCT_CATEGORIES = [
  "Prebuilt PCs",
  "CPU",
  "GPU",
  "Motherboard",
  "RAM",
  "Storage",
  "Power Supply",
  "Cooler",
  "Case",
  "OS",
  "Networking",
  "RGB",
  "CaptureCard",
  "Monitor",
  "Keyboard",
  "Mouse",
  "Mousepad",
  "Headset",
  "Speakers",
  "Controller",
  "ExternalStorage",
  "VR",
  "StreamingGear",
  "Microphone",
  "Webcam",
  "GamingChair",
  "GamingDesk",
  "SoundCard",
  "Cables",
  "GamingLaptop",
  "Games",
  "PCGames",
  "ConsoleGames",
  "VRGames",
]

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [products, setProducts] = useState(mockProducts)
  const [detailsProduct, setDetailsProduct] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const handleAddProduct = (newProduct: any) => {
    if (editingProduct) {
      setProducts(products.map((p) => (p._id === editingProduct._id ? { ...newProduct, _id: editingProduct._id } : p)))
      setEditingProduct(null)
    } else {
      setProducts([...products, { ...newProduct, _id: `507f1f77bcf86cd799${Date.now()}` }])
    }
    setIsModalOpen(false)
  }

  const handleDeleteProduct = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      setProducts(products.filter((p) => p._id !== id))
    }
  }

  const handleToggleVisibility = (id: string) => {
    setProducts(products.map((p) => (p._id === id ? { ...p, isActive: !p.isActive } : p)))
  }

  const handleEditProduct = (product: any) => {
    setEditingProduct(product)
    setIsModalOpen(true)
  }

  const handleViewDetails = (product: any) => {
    setDetailsProduct(product)
    setIsDetailsOpen(true)
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? product.isActive : !product.isActive)
    return matchesSearch && matchesCategory && matchesStatus
  })

  const isLowStock = (stock: number) => stock < 10 && stock > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Products</h1>
          <p className="text-[#A0A0A8] mt-1">Manage your product inventory</p>
        </div>
        <Button
          onClick={() => {
            setEditingProduct(null)
            setIsModalOpen(true)
          }}
          className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] hover:shadow-lg hover:shadow-purple-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search by name, SKU, or brand..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-[#1F1F28] border-[#2A2A35] text-white placeholder:text-[#A0A0A8]"
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
        >
          <option value="all">All Categories</option>
          {PRODUCT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            onView={handleViewDetails}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
            onToggleVisibility={handleToggleVisibility}
          />
        ))}
      </div>

      {/* Inventory Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Products</p>
          <p className="text-2xl font-bold text-white mt-2">{mockProducts.length}</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Low Stock Items</p>
          <p className="text-2xl font-bold text-yellow-400 mt-2">
            {mockProducts.filter((p) => p.stock < 10 && p.stock > 0).length}
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Out of Stock</p>
          <p className="text-2xl font-bold text-red-400 mt-2">{mockProducts.filter((p) => p.stock === 0).length}</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Sales</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">
            {mockProducts.reduce((sum, p) => sum + p.salesCount, 0)}
          </p>
        </Card>
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingProduct(null)
        }}
        onSubmit={handleAddProduct}
        initialData={editingProduct}
        isEditing={!!editingProduct}
      />

      <ProductDetailsModal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} product={detailsProduct} />
    </div>
  )
}
