"use client";

import type React from "react";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";

interface Coupon {
  id?: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  valid_from: string;
  valid_to: string;
  min_purchase?: number;
  max_discount?: number;
  is_active: boolean;
  created_at?: string;
  usage_limit?: number;
  times_used?: number;
}

interface CouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (coupon: Coupon) => void;
  initialData?: Coupon;
}

export function CouponModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: CouponModalProps) {
  const [formData, setFormData] = useState<Coupon>({
    code: "",
    discount_type: "percentage",
    discount_value: 0,
    valid_from: new Date().toISOString().split("T")[0],
    valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    min_purchase: 0,
    max_discount: undefined,
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      // Helper to safely parse dates
      const safeDate = (dateValue: any, fallback: string) => {
        if (!dateValue) return fallback;
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime())
          ? fallback
          : parsed.toISOString().split("T")[0];
      };

      const today = new Date().toISOString().split("T")[0];
      const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      setFormData({
        ...initialData,
        valid_from: safeDate(initialData.valid_from, today),
        valid_to: safeDate(initialData.valid_to, defaultEnd),
      });
    } else {
      setFormData({
        code: "",
        discount_type: "percentage",
        discount_value: 0,
        valid_from: new Date().toISOString().split("T")[0],
        valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        min_purchase: 0,
        max_discount: undefined,
        is_active: true,
      });
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = "Coupon code is required";
    } else if (formData.code.length < 3) {
      newErrors.code = "Code must be at least 3 characters";
    }

    if (formData.discount_value <= 0) {
      newErrors.discount_value = "Discount value must be greater than 0";
    }

    if (
      formData.discount_type === "percentage" &&
      formData.discount_value > 100
    ) {
      newErrors.discount_value = "Percentage discount cannot exceed 100%";
    }

    const validFrom = new Date(formData.valid_from);
    const validTo = new Date(formData.valid_to);

    if (validTo <= validFrom) {
      newErrors.valid_to = "Valid to date must be after valid from date";
    }

    if (formData.min_purchase && formData.min_purchase < 0) {
      newErrors.min_purchase = "Minimum purchase cannot be negative";
    }

    if (formData.max_discount && formData.max_discount < 0) {
      newErrors.max_discount = "Maximum discount cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        ...formData,
        code: formData.code.toUpperCase(),
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_to: new Date(formData.valid_to).toISOString(),
      });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1F1F28] border-[#2A2A35] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {initialData ? "Edit Coupon" : "Create Coupon"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
              Coupon Code
            </label>
            <Input
              type="text"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              disabled={!!initialData}
              placeholder="e.g., SAVE20"
              className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
            />
            {errors.code && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.code}
              </p>
            )}
          </div>

          {/* Discount Type */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
              Discount Type
            </label>
            <select
              value={formData.discount_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  discount_type: e.target.value as "percentage" | "fixed",
                })
              }
              className="w-full px-3 py-2 bg-[#2A2A35] border border-[#3A3A45] text-white rounded-lg"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed ($)</option>
            </select>
          </div>

          {/* Discount Value */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
              Discount Value
            </label>
            <Input
              type="number"
              value={formData.discount_value}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  discount_value: Number.parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0"
              min="0"
              step="0.01"
              className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
            />
            {errors.discount_value && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.discount_value}
              </p>
            )}
          </div>

          {/* Valid From */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
              Valid From
            </label>
            <Input
              type="date"
              value={formData.valid_from}
              onChange={(e) =>
                setFormData({ ...formData, valid_from: e.target.value })
              }
              className="bg-[#2A2A35] border-[#3A3A45] text-white"
            />
          </div>

          {/* Valid To */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
              Valid To
            </label>
            <Input
              type="date"
              value={formData.valid_to}
              onChange={(e) =>
                setFormData({ ...formData, valid_to: e.target.value })
              }
              className="bg-[#2A2A35] border-[#3A3A45] text-white"
            />
            {errors.valid_to && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.valid_to}
              </p>
            )}
          </div>

          {/* Min Purchase */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
              Minimum Purchase (Optional)
            </label>
            <Input
              type="number"
              value={formData.min_purchase ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  min_purchase: e.target.value
                    ? Number.parseFloat(e.target.value)
                    : undefined,
                })
              }
              placeholder="0"
              min="0"
              step="0.01"
              className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
            />
            {errors.min_purchase && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.min_purchase}
              </p>
            )}
          </div>

          {/* Max Discount */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
              Maximum Discount (Optional)
            </label>
            <Input
              type="number"
              value={formData.max_discount ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  max_discount: e.target.value
                    ? Number.parseFloat(e.target.value)
                    : undefined,
                })
              }
              placeholder="0"
              min="0"
              step="0.01"
              className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
            />
            {errors.max_discount && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.max_discount}
              </p>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="w-4 h-4 rounded"
            />
            <label
              htmlFor="isActive"
              className="text-sm font-medium text-[#A0A0A8]"
            >
              Active
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#2A2A35] hover:bg-[#3A3A45] text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-linear-to-r from-[#7C3AED] to-[#3B82F6] hover:shadow-lg hover:shadow-purple-500/20"
            >
              {initialData ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
