"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { ProductModal } from "../components/product-modal";
import { ProductDetailsModal } from "../components/product-details-modal";
import { ProductCard } from "../components/product-card";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

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
];

export default function ProductsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [productStats, setProductStats] = useState<any>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [detailsProduct, setDetailsProduct] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const query: any = {
        page,
        limit,
        sortBy: "created_at",
        sortOrder: "desc",
      };

      if (searchTerm) query.search = searchTerm;
      if (categoryFilter !== "all") query.category = categoryFilter;
      if (statusFilter !== "all")
        query.isActive = statusFilter === "active" ? "true" : "false";

      const [productsData, statsData] = await Promise.all([
        apiClient.getProducts(query),
        apiClient.getProductStats(),
      ]);

      setProducts(productsData.data);
      setTotalPages(productsData.pages);
      setTotalProducts(productsData.count);
      setProductStats(statsData);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, limit, categoryFilter, statusFilter]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleAddProduct = async (newProduct: any) => {
    try {
      if (editingProduct) {
        await apiClient.updateProduct(editingProduct.id, newProduct);
        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        await apiClient.createProduct(newProduct);
        toast({
          title: "Success",
          description: "Product created successfully",
        });
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save product",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await apiClient.deleteProduct(Number(id)); // Assuming ID is number based on api-client
        toast({
          title: "Success",
          description: "Product deleted successfully",
        });
        fetchProducts();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete product",
          variant: "destructive",
        });
      }
    }
  };

  const handleToggleVisibility = async (id: string) => {
    try {
      await apiClient.toggleProductActive(Number(id));
      toast({ title: "Success", description: "Product status updated" });
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update product status",
        variant: "destructive",
      });
    }
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleViewDetails = (product: any) => {
    setDetailsProduct(product);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Products</h1>
          <p className="text-[#A0A0A8] mt-1">Manage your product inventory</p>
        </div>
        <Button
          onClick={() => {
            setEditingProduct(null);
            setIsModalOpen(true);
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
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="bg-[#1F1F28] border-[#2A2A35] text-white placeholder:text-[#A0A0A8]"
        />

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
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
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onView={handleViewDetails}
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
              onToggleVisibility={handleToggleVisibility}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-[#A0A0A8]">
            Showing {products.length === 0 ? 0 : (page - 1) * limit + 1} to{" "}
            {Math.min(page * limit, totalProducts)} of {totalProducts} products
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <Button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Inventory Summary */}
      {productStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Total Products</p>
            <p className="text-2xl font-bold text-white mt-2">
              {productStats.totalProducts}
            </p>
          </Card>
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">
              Low Stock Items
            </p>
            <p className="text-2xl font-bold text-yellow-400 mt-2">
              {productStats.lowStock}
            </p>
          </Card>
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Out of Stock</p>
            <p className="text-2xl font-bold text-red-400 mt-2">
              {productStats.outOfStock}
            </p>
          </Card>
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">
              Active Products
            </p>
            <p className="text-2xl font-bold text-blue-400 mt-2">
              {productStats.activeProducts}
            </p>
          </Card>
        </div>
      )}

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleAddProduct}
        initialData={editingProduct}
        isEditing={!!editingProduct}
      />

      <ProductDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        product={detailsProduct}
      />
    </div>
  );
}
