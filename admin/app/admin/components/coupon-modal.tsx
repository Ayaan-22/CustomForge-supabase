"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle } from "lucide-react"

interface Coupon {
  _id?: string
  code: string
  discountType: "percentage" | "fixed"
  discountValue: number
  validFrom: string
  validTo: string
  minPurchase?: number
  maxDiscount?: number
  isActive: boolean
  createdAt?: string
}

interface CouponModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (coupon: Coupon) => void
  initialData?: Coupon
}

export function CouponModal({ isOpen, onClose, onSubmit, initialData }: CouponModalProps) {
  const [formData, setFormData] = useState<Coupon>({
    code: "",
    discountType: "percentage",
    discountValue: 0,
    validFrom: new Date().toISOString().split("T")[0],
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    minPurchase: 0,
    maxDiscount: undefined,
    isActive: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        validFrom: new Date(initialData.validFrom).toISOString().split("T")[0],
        validTo: new Date(initialData.validTo).toISOString().split("T")[0],
      })
    } else {
      setFormData({
        code: "",
        discountType: "percentage",
        discountValue: 0,
        validFrom: new Date().toISOString().split("T")[0],
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        minPurchase: 0,
        maxDiscount: undefined,
        isActive: true,
      })
    }
    setErrors({})
  }, [initialData, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.code.trim()) {
      newErrors.code = "Coupon code is required"
    } else if (formData.code.length < 3) {
      newErrors.code = "Code must be at least 3 characters"
    }

    if (formData.discountValue <= 0) {
      newErrors.discountValue = "Discount value must be greater than 0"
    }

    if (formData.discountType === "percentage" && formData.discountValue > 100) {
      newErrors.discountValue = "Percentage discount cannot exceed 100%"
    }

    const validFrom = new Date(formData.validFrom)
    const validTo = new Date(formData.validTo)

    if (validTo <= validFrom) {
      newErrors.validTo = "Valid to date must be after valid from date"
    }

    if (formData.minPurchase && formData.minPurchase < 0) {
      newErrors.minPurchase = "Minimum purchase cannot be negative"
    }

    if (formData.maxDiscount && formData.maxDiscount < 0) {
      newErrors.maxDiscount = "Maximum discount cannot be negative"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit({
        ...formData,
        code: formData.code.toUpperCase(),
        validFrom: new Date(formData.validFrom).toISOString(),
        validTo: new Date(formData.validTo).toISOString(),
      })
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1F1F28] border-[#2A2A35] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{initialData ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Coupon Code</label>
            <Input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
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
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Discount Type</label>
            <select
              value={formData.discountType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  discountType: e.target.value as "percentage" | "fixed",
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
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Discount Value</label>
            <Input
              type="number"
              value={formData.discountValue}
              onChange={(e) => setFormData({ ...formData, discountValue: Number.parseFloat(e.target.value) || 0 })}
              placeholder="0"
              min="0"
              step="0.01"
              className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
            />
            {errors.discountValue && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.discountValue}
              </p>
            )}
          </div>

          {/* Valid From */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Valid From</label>
            <Input
              type="date"
              value={formData.validFrom}
              onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
              className="bg-[#2A2A35] border-[#3A3A45] text-white"
            />
          </div>

          {/* Valid To */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Valid To</label>
            <Input
              type="date"
              value={formData.validTo}
              onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
              className="bg-[#2A2A35] border-[#3A3A45] text-white"
            />
            {errors.validTo && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.validTo}
              </p>
            )}
          </div>

          {/* Min Purchase */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Minimum Purchase (Optional)</label>
            <Input
              type="number"
              value={formData.minPurchase || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  minPurchase: e.target.value ? Number.parseFloat(e.target.value) : undefined,
                })
              }
              placeholder="0"
              min="0"
              step="0.01"
              className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
            />
            {errors.minPurchase && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.minPurchase}
              </p>
            )}
          </div>

          {/* Max Discount */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Maximum Discount (Optional)</label>
            <Input
              type="number"
              value={formData.maxDiscount || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxDiscount: e.target.value ? Number.parseFloat(e.target.value) : undefined,
                })
              }
              placeholder="0"
              min="0"
              step="0.01"
              className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
            />
            {errors.maxDiscount && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.maxDiscount}
              </p>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-[#A0A0A8]">
              Active
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} className="flex-1 bg-[#2A2A35] hover:bg-[#3A3A45] text-white">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] hover:shadow-lg hover:shadow-purple-500/20"
            >
              {initialData ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
