"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  Package,
  Truck,
  RotateCcw,
  CreditCard,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  processing: "bg-blue-500/20 text-blue-400",
  shipped: "bg-cyan-500/20 text-cyan-400",
  delivered: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
  refunded: "bg-purple-500/20 text-purple-400",
  returned: "bg-pink-500/20 text-pink-400",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Package className="w-4 h-4" />,
  processing: <Package className="w-4 h-4" />,
  shipped: <Truck className="w-4 h-4" />,
  delivered: <Truck className="w-4 h-4" />,
  cancelled: <RotateCcw className="w-4 h-4" />,
  refunded: <RotateCcw className="w-4 h-4" />,
  returned: <RotateCcw className="w-4 h-4" />,
};

export default function OrdersPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [orderStats, setOrderStats] = useState<any>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Note: The current getOrders API might not support all these query params yet based on the client,
      // but we'll implement it as if it does or filter client-side if needed.
      // Based on api-client.ts, getOrders() takes no args currently, so we might need to update it or
      // accept that we get all orders and filter client side for now.
      // However, looking at the server controller, it seems to just return all orders.
      // Let's fetch all and filter client-side for now until pagination is added to the API.

      const [ordersData, statsData] = await Promise.all([
        apiClient.getOrders(),
        apiClient.getOrderAnalytics("30d"),
      ]);

      let filtered = ordersData.data || ordersData; // Handle if it returns { data: [] } or []

      // Apply client-side filtering since API might be limited
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (o: any) =>
            o.id.toLowerCase().includes(lowerSearch) ||
            o.user_id?.toLowerCase().includes(lowerSearch)
        );
      }

      if (statusFilter !== "all") {
        filtered = filtered.filter((o: any) => o.status === statusFilter);
      }

      setTotalOrders(filtered.length);
      setTotalPages(Math.ceil(filtered.length / limit));

      // Client-side pagination
      const start = (page - 1) * limit;
      setOrders(filtered.slice(start, start + limit));

      setOrderStats(statsData);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      toast({
        title: "Error",
        description: "Failed to fetch orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, limit, statusFilter]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      if (status === "delivered") {
        await apiClient.deliverOrder(id);
      } else {
        await apiClient.updateOrderStatus(id, status);
      }
      toast({ title: "Success", description: `Order marked as ${status}` });
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const handleProcessReturn = async (id: string) => {
    try {
      await apiClient.processReturn(id);
      toast({ title: "Success", description: "Return processed successfully" });
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process return",
        variant: "destructive",
      });
    }
  };

  const statuses = [
    "all",
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Orders</h1>
          <p className="text-[#A0A0A8] mt-1">
            Manage customer orders and shipments
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search by order ID..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="bg-[#1F1F28] border-[#2A2A35] text-white placeholder:text-[#A0A0A8]"
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status === "all"
                ? "All Status"
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
      <Card className="glass-dark p-6 border-[#2A2A35]">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-[#A0A0A8]">
                No orders found
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id}>
                  <button
                    onClick={() =>
                      setExpandedOrder(
                        expandedOrder === order.id ? null : order.id
                      )
                    }
                    className="w-full flex items-center justify-between p-4 hover:bg-[#1F1F28] rounded-lg transition-colors border border-[#2A2A35]"
                  >
                    <div className="flex items-center gap-4 flex-1 text-left">
                      <div>
                        <p className="text-white font-medium">
                          {order.id.slice(0, 8)}...
                        </p>
                        <p className="text-[#A0A0A8] text-sm">
                          User: {order.user_id?.slice(0, 8) || "Guest"}
                        </p>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                      <div>
                        <p className="text-white font-medium">
                          ${Number(order.total_price).toFixed(2)}
                        </p>
                        <p className="text-[#A0A0A8] text-sm">
                          {order.items?.length || 0} items
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                          statusColors[order.status] || statusColors.pending
                        }`}
                      >
                        {statusIcons[order.status] || statusIcons.pending}
                        {order.status.charAt(0).toUpperCase() +
                          order.status.slice(1)}
                      </span>

                      <p className="text-[#A0A0A8] text-sm w-24">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <ChevronDown
                      className={`w-5 h-5 text-[#A0A0A8] transition-transform ${
                        expandedOrder === order.id ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Expanded Details */}
                  {expandedOrder === order.id && (
                    <div className="bg-[#1F1F28] p-6 rounded-lg border border-[#2A2A35] space-y-6">
                      {/* Order Items */}
                      <div>
                        <h3 className="text-white font-semibold mb-3">
                          Order Items
                        </h3>
                        <div className="space-y-2">
                          {order.items?.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-2 bg-[#0F0F14] rounded"
                            >
                              {/* <img
                                src={item.image || "/placeholder.svg"}
                                alt={item.name}
                                className="w-12 h-12 rounded object-cover"
                              /> */}
                              <div className="flex-1">
                                <p className="text-white text-sm font-medium">
                                  {item.name || "Product Name"}
                                </p>
                                <p className="text-[#A0A0A8] text-xs">
                                  {item.quantity}x $
                                  {Number(item.price).toFixed(2)}
                                </p>
                              </div>
                              <p className="text-white font-medium">
                                $
                                {(
                                  Number(item.price) * (item.quantity || 1)
                                ).toFixed(2)}
                              </p>
                            </div>
                          ))}
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
                            <p className="text-[#A0A0A8]">Payment Status</p>
                            <p
                              className={
                                order.is_paid
                                  ? "text-green-400"
                                  : "text-yellow-400"
                              }
                            >
                              {order.is_paid ? "Paid" : "Pending"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Pricing Breakdown */}
                      <div className="border-t border-[#2A2A35] pt-4">
                        <h3 className="text-white font-semibold mb-3">
                          Pricing Breakdown
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between border-t border-[#2A2A35] pt-2 mt-2">
                            <span className="text-white font-semibold">
                              Total
                            </span>
                            <span className="text-white font-semibold">
                              ${Number(order.total_price).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-4 border-t border-[#2A2A35] flex-wrap">
                        {order.status === "pending" && (
                          <Button
                            onClick={() =>
                              handleUpdateStatus(order.id, "processing")
                            }
                            className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                          >
                            <Package className="w-4 h-4 mr-2" />
                            Mark as Processing
                          </Button>
                        )}
                        {order.status === "processing" && (
                          <Button
                            onClick={() =>
                              handleUpdateStatus(order.id, "shipped")
                            }
                            className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            Mark as Shipped
                          </Button>
                        )}
                        {order.status === "shipped" && (
                          <Button
                            onClick={() =>
                              handleUpdateStatus(order.id, "delivered")
                            }
                            className="bg-green-500/20 text-green-400 hover:bg-green-500/30"
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            Mark as Delivered
                          </Button>
                        )}
                        {(order.status === "delivered" ||
                          order.status === "processing") && (
                          <Button
                            onClick={() => handleProcessReturn(order.id)}
                            className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Process Return
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {!loading && orders.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-[#A0A0A8]">
              Showing {orders.length === 0 ? 0 : (page - 1) * limit + 1} to{" "}
              {Math.min(page * limit, totalOrders)} of {totalOrders} orders
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                variant="outline"
                size="sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                variant="outline"
                size="sm"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Order Stats */}
      {orderStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Total Orders</p>
            <p className="text-2xl font-bold text-white mt-2">
              {orderStats.totalOrders}
            </p>
          </Card>
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Paid Orders</p>
            <p className="text-2xl font-bold text-green-400 mt-2">
              {orderStats.paidOrders}
            </p>
          </Card>
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-blue-400 mt-2">
              ${orderStats.totalRevenue}
            </p>
          </Card>
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Growth</p>
            <p className="text-2xl font-bold text-purple-400 mt-2">
              {orderStats.growth}%
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
