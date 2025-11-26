"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Star, Package, DollarSign, TrendingUp } from "lucide-react";

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

export function ProductDetailsModal({
  isOpen,
  onClose,
  product,
}: ProductDetailsModalProps) {
  if (!isOpen || !product) return null;

  const discountAmount =
    (product.original_price * product.discount_percentage) / 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <Card className="glass-dark border-[#2A2A35] w-full max-w-4xl mx-4 my-8 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Product Details</h2>
          <button onClick={onClose} className="text-[#A0A0A8] hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Basic Information */}
          <div className="bg-[#1F1F28] border border-[#2A2A35] rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#7C3AED]" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#A0A0A8]">Product Name</p>
                <p className="text-white font-medium">{product.name}</p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">SKU</p>
                <p className="text-white font-medium">{product.sku}</p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Brand</p>
                <p className="text-white font-medium">{product.brand}</p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Category</p>
                <p className="text-white font-medium">{product.category}</p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Status</p>
                <p
                  className={`font-medium ${
                    product.is_active ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {product.is_active ? "Active" : "Inactive"}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Featured</p>
                <p
                  className={`font-medium ${
                    product.is_featured ? "text-blue-400" : "text-[#A0A0A8]"
                  }`}
                >
                  {product.is_featured ? "Yes" : "No"}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Information */}
          <div className="bg-[#1F1F28] border border-[#2A2A35] rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Pricing
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#A0A0A8]">Original Price</p>
                <p className="text-white font-medium">
                  ${product.original_price.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Discount Percentage</p>
                <p className="text-white font-medium">
                  {product.discount_percentage}%
                </p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Discount Amount</p>
                <p className="text-green-400 font-medium">
                  -${discountAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Final Price</p>
                <p className="text-white font-medium text-lg">
                  ${(product.final_price ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Inventory Information */}
          <div className="bg-[#1F1F28] border border-[#2A2A35] rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#3B82F6]" />
              Inventory
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#A0A0A8]">Stock Quantity</p>
                <p
                  className={`font-medium text-lg ${
                    product.stock === 0
                      ? "text-red-400"
                      : product.stock < 10
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {product.stock} units
                </p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Availability</p>
                <p
                  className={`font-medium ${
                    product.availability === "In Stock"
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {product.availability}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Sales Count</p>
                <p className="text-blue-400 font-medium">
                  {product.sales_count}
                </p>
              </div>
            </div>
          </div>

          {/* Performance & Ratings */}
          <div className="bg-[#1F1F28] border border-[#2A2A35] rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
              Performance & Ratings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#A0A0A8]">Average Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <p className="text-white font-medium">
                    {product.ratings?.average ?? 0}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-[#A0A0A8]">Total Reviews</p>
                <p className="text-white font-medium">
                  {product.ratings?.total_reviews ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="bg-[#1F1F28] border border-[#2A2A35] rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">
                Description
              </h3>
              <p className="text-[#A0A0A8] leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Specifications */}
          {product.specifications &&
            Object.keys(product.specifications).length > 0 && (
              <div className="bg-[#1F1F28] border border-[#2A2A35] rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Specifications
                </h3>
                <div className="space-y-2">
                  {Object.entries(product.specifications).map(
                    ([key, value]: [string, any]) => (
                      <div
                        key={key}
                        className="flex justify-between items-start"
                      >
                        <span className="text-[#A0A0A8] capitalize">
                          {key.replace(/_/g, " ")}:
                        </span>
                        <span className="text-white font-medium">
                          {String(value)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {/* Features */}
          {product.features && product.features.length > 0 && (
            <div className="bg-[#1F1F28] border border-[#2A2A35] rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">
                Features
              </h3>
              <ul className="space-y-2">
                {product.features.map((feature: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#7C3AED] mt-1">•</span>
                    <span className="text-[#A0A0A8]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Additional Details */}
          <div className="bg-[#1F1F28] border border-[#2A2A35] rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Additional Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {product.warranty && (
                <div>
                  <p className="text-sm text-[#A0A0A8]">Warranty</p>
                  <p className="text-white font-medium">{product.warranty}</p>
                </div>
              )}
              {product.weight && (
                <div>
                  <p className="text-sm text-[#A0A0A8]">Weight</p>
                  <p className="text-white font-medium">{product.weight} kg</p>
                </div>
              )}
              {product.dimensions && (
                <div className="col-span-2">
                  <p className="text-sm text-[#A0A0A8] mb-2">
                    Dimensions (L×W×H)
                  </p>
                  <p className="text-white font-medium">
                    {product.dimensions.length} × {product.dimensions.width} ×{" "}
                    {product.dimensions.height} cm
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Images */}
          {product.images && product.images.length > 0 && (
            <div className="bg-[#1F1F28] border border-[#2A2A35] rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">
                Product Images
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {product.images.map((image: string, idx: number) => (
                  <img
                    key={idx}
                    src={image || "/placeholder.svg"}
                    alt={`Product ${idx + 1}`}
                    className="w-full h-32 object-cover rounded border border-[#2A2A35]"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-[#2A2A35] mt-6">
          <Button
            onClick={onClose}
            className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] hover:shadow-lg hover:shadow-purple-500/20"
          >
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
