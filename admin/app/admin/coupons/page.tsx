"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, Trash2, Copy, AlertCircle, Eye } from "lucide-react";
import { CouponModal } from "../components/coupon-modal";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface Coupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  valid_from: string;
  valid_to: string;
  min_purchase?: number;
  max_discount?: number;
  is_active: boolean;
  created_at: string;
  usage_limit?: number;
  times_used?: number;
}

export default function CouponsPage() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | undefined>();
  const [viewingCoupon, setViewingCoupon] = useState<Coupon | undefined>();

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getCoupons();
      // Handle both wrapped and unwrapped responses just in case
      const data = response.data || response;
      setCoupons(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch coupons:", error);
      toast({
        title: "Error",
        description: "Failed to fetch coupons",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const filteredCoupons = coupons.filter((coupon) => {
    const matchesSearch = coupon.code
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active"
        ? coupon.is_active && !isExpired(coupon.valid_to)
        : !coupon.is_active || isExpired(coupon.valid_to));
    return matchesSearch && matchesActive;
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isExpired = (validTo: string) =>
    validTo ? new Date(validTo) < new Date() : false;

  const isExpiringSoon = (validTo: string) => {
    if (!validTo) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(validTo).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleCreateCoupon = () => {
    setSelectedCoupon(undefined);
    setIsModalOpen(true);
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setIsModalOpen(true);
  };

  const handleDeleteCoupon = async (id: string) => {
    if (confirm("Are you sure you want to delete this coupon?")) {
      try {
        await apiClient.deleteCoupon(id);
        toast({ title: "Success", description: "Coupon deleted successfully" });
        fetchCoupons();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete coupon",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmitCoupon = async (couponData: any) => {
    try {
      if (selectedCoupon) {
        await apiClient.updateCoupon(selectedCoupon.id, couponData);
        toast({ title: "Success", description: "Coupon updated successfully" });
      } else {
        await apiClient.createCoupon(couponData);
        toast({ title: "Success", description: "Coupon created successfully" });
      }
      setIsModalOpen(false);
      fetchCoupons();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save coupon",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Coupons</h1>
          <p className="text-[#A0A0A8] mt-1">Manage discount coupons</p>
        </div>
        <Button
          onClick={handleCreateCoupon}
          className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] hover:shadow-lg hover:shadow-purple-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search by coupon code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-[#1F1F28] border-[#2A2A35] text-white placeholder:text-[#A0A0A8]"
        />

        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Coupons Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.length === 0 ? (
            <div className="col-span-full text-center py-8 text-[#A0A0A8]">
              No coupons found
            </div>
          ) : (
            filteredCoupons.map((coupon) => {
              const expired = isExpired(coupon.valid_to);
              const expiringSoon = isExpiringSoon(coupon.valid_to);

              return (
                <Card
                  key={coupon.id}
                  className={`glass-dark p-6 border-[#2A2A35] transition-all ${
                    expired || !coupon.is_active
                      ? "opacity-60"
                      : expiringSoon
                      ? "border-yellow-500/50"
                      : ""
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[#A0A0A8] text-sm font-medium">
                        Coupon Code
                      </p>
                      <p className="text-white font-mono font-bold text-lg mt-1">
                        {coupon.code}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopyCode(coupon.code)}
                      className="p-2 hover:bg-[#2A2A35] rounded transition-colors"
                    >
                      <Copy
                        className={`w-4 h-4 ${
                          copiedCode === coupon.code
                            ? "text-green-400"
                            : "text-[#A0A0A8]"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Discount */}
                  <div className="mb-4 p-3 bg-gradient-to-r from-[#7C3AED]/20 to-[#3B82F6]/20 rounded-lg">
                    <p className="text-2xl font-bold text-white">
                      {coupon.discount_value}
                      {coupon.discount_type === "percentage" ? "%" : "$"}
                    </p>
                    <p className="text-[#A0A0A8] text-sm">
                      {coupon.discount_type === "percentage"
                        ? "Percentage Discount"
                        : "Fixed Discount"}
                    </p>
                  </div>

                  {/* Validity */}
                  <div className="space-y-2 mb-4 pb-4 border-b border-[#2A2A35]">
                    <div>
                      <p className="text-[#A0A0A8] text-xs">Valid From</p>
                      <p className="text-white text-sm">
                        {formatDate(coupon.valid_from)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#A0A0A8] text-xs">Valid To</p>
                      <p
                        className={`text-sm ${
                          expired
                            ? "text-red-400"
                            : expiringSoon
                            ? "text-yellow-400"
                            : "text-white"
                        }`}
                      >
                        {formatDate(coupon.valid_to)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 pb-4 border-b border-[#2A2A35]">
                    {coupon.min_purchase && coupon.min_purchase > 0 && (
                      <div>
                        <p className="text-[#A0A0A8] text-xs">Min Purchase</p>
                        <p className="text-white text-sm">
                          ${coupon.min_purchase}
                        </p>
                      </div>
                    )}
                    {coupon.max_discount && (
                      <div>
                        <p className="text-[#A0A0A8] text-xs">Max Discount</p>
                        <p className="text-white text-sm">
                          ${coupon.max_discount}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                        expired
                          ? "bg-red-500/20 text-red-400"
                          : expiringSoon
                          ? "bg-yellow-500/20 text-yellow-400"
                          : !coupon.is_active
                          ? "bg-gray-500/20 text-gray-400"
                          : "bg-green-500/20 text-green-400"
                      }`}
                    >
                      {expired ? (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          Expired
                        </>
                      ) : expiringSoon ? (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          Expiring Soon
                        </>
                      ) : !coupon.is_active ? (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          Inactive
                        </>
                      ) : (
                        "Active"
                      )}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingCoupon(coupon)}
                      className="flex-1 p-2 hover:bg-[#2A2A35] rounded transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-400 text-sm">View</span>
                    </button>
                    <button
                      onClick={() => handleEditCoupon(coupon)}
                      className="flex-1 p-2 hover:bg-[#2A2A35] rounded transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit2 className="w-4 h-4 text-[#A0A0A8]" />
                      <span className="text-[#A0A0A8] text-sm">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="flex-1 p-2 hover:bg-red-500/20 rounded transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 text-sm">Delete</span>
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Coupon Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Coupons</p>
          <p className="text-2xl font-bold text-white mt-2">{coupons.length}</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Active</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {
              coupons.filter((c) => c.is_active && !isExpired(c.valid_to))
                .length
            }
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Expired</p>
          <p className="text-2xl font-bold text-red-400 mt-2">
            {coupons.filter((c) => isExpired(c.valid_to)).length}
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Inactive</p>
          <p className="text-2xl font-bold text-gray-400 mt-2">
            {coupons.filter((c) => !c.is_active).length}
          </p>
        </Card>
      </div>

      {/* Modals */}
      <CouponModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCoupon(undefined);
        }}
        onSubmit={handleSubmitCoupon}
        initialData={selectedCoupon}
      />

      {/* View Details Modal */}
      {viewingCoupon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="glass-dark p-8 border-[#2A2A35] max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Coupon Details</h2>
              <button
                onClick={() => setViewingCoupon(undefined)}
                className="text-[#A0A0A8] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[#A0A0A8] text-sm">Code</p>
                <p className="text-white font-mono font-bold text-lg">
                  {viewingCoupon.code}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[#A0A0A8] text-sm">Type</p>
                  <p className="text-white capitalize">
                    {viewingCoupon.discount_type}
                  </p>
                </div>
                <div>
                  <p className="text-[#A0A0A8] text-sm">Value</p>
                  <p className="text-white">
                    {viewingCoupon.discount_value}
                    {viewingCoupon.discount_type === "percentage" ? "%" : "$"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[#A0A0A8] text-sm">Valid From</p>
                <p className="text-white">
                  {formatDate(viewingCoupon.valid_from)}
                </p>
              </div>

              <div>
                <p className="text-[#A0A0A8] text-sm">Valid To</p>
                <p className="text-white">
                  {formatDate(viewingCoupon.valid_to)}
                </p>
              </div>

              {viewingCoupon.min_purchase && viewingCoupon.min_purchase > 0 && (
                <div>
                  <p className="text-[#A0A0A8] text-sm">Minimum Purchase</p>
                  <p className="text-white">${viewingCoupon.min_purchase}</p>
                </div>
              )}

              {viewingCoupon.max_discount && (
                <div>
                  <p className="text-[#A0A0A8] text-sm">Maximum Discount</p>
                  <p className="text-white">${viewingCoupon.max_discount}</p>
                </div>
              )}

              <div>
                <p className="text-[#A0A0A8] text-sm">Status</p>
                <p
                  className={`${
                    viewingCoupon.is_active ? "text-green-400" : "text-gray-400"
                  }`}
                >
                  {viewingCoupon.is_active ? "Active" : "Inactive"}
                </p>
              </div>

              <Button
                onClick={() => setViewingCoupon(undefined)}
                className="w-full bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] hover:shadow-lg hover:shadow-purple-500/20 mt-6"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
