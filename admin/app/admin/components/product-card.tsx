"use client"

import { Card } from "@/components/ui/card"
import { Star, Eye, Edit2, Trash2, EyeOff } from "lucide-react"

interface ProductCardProps {
  product: any
  onView: (product: any) => void
  onEdit: (product: any) => void
  onDelete: (id: string) => void
  onToggleVisibility: (id: string) => void
}

export function ProductCard({ product, onView, onEdit, onDelete, onToggleVisibility }: ProductCardProps) {
  const isLowStock = product.stock < 10 && product.stock > 0

  return (
    <Card className="glass-dark border-[#2A2A35] overflow-hidden hover:border-[#3A3A45] transition-colors">
      {/* Product Image */}
      <div className="relative h-48 bg-[#0F0F15] overflow-hidden">
        {product.images && product.images[0] ? (
          <img
            src={product.images[0] || "/placeholder.svg"}
            alt={product.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#A0A0A8]">
            <div className="text-center">
              <p className="text-sm">No image</p>
            </div>
          </div>
        )}
        {/* Featured Badge */}
        {product.isFeatured && (
          <div className="absolute top-2 right-2 bg-yellow-400/20 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
            Featured
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 space-y-3">
        {/* Name & Category */}
        <div>
          <p className="text-xs text-[#A0A0A8] mb-1">{product.category}</p>
          <p className="text-white font-semibold truncate">{product.name}</p>
          <p className="text-xs text-[#A0A0A8]">{product.brand}</p>
        </div>

        {/* Pricing */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg">${product.finalPrice}</span>
            {product.discountPercentage > 0 && (
              <span className="text-xs line-through text-[#A0A0A8]">${product.originalPrice}</span>
            )}
          </div>
          {product.discountPercentage > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 inline-block">
              Save {product.discountPercentage}%
            </span>
          )}
        </div>

        {/* Stock Status */}
        <div>
          <p className="text-xs text-[#A0A0A8] mb-1">Stock</p>
          <p
            className={`text-sm font-semibold ${
              product.stock === 0 ? "text-red-400" : isLowStock ? "text-yellow-400" : "text-green-400"
            }`}
          >
            {product.stock} units
          </p>
        </div>

        {/* Rating */}
        {product.ratings && (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-white text-sm font-medium">{product.ratings.average}</span>
            <span className="text-xs text-[#A0A0A8]">({product.ratings.totalReviews})</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-[#2A2A35]">
          <button
            onClick={() => onView(product)}
            className="flex-1 px-2 py-2 text-xs font-medium bg-[#7C3AED]/20 text-[#7C3AED] hover:bg-[#7C3AED]/30 rounded transition-colors flex items-center justify-center gap-1"
          >
            <Eye className="w-3 h-3" />
            View
          </button>
          <button
            onClick={() => onEdit(product)}
            className="p-2 hover:bg-[#2A2A35] rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3 h-3 text-[#A0A0A8]" />
          </button>
          <button
            onClick={() => onToggleVisibility(product._id)}
            className="p-2 hover:bg-[#2A2A35] rounded transition-colors"
            title={product.isActive ? "Hide" : "Show"}
          >
            {product.isActive ? (
              <Eye className="w-3 h-3 text-[#A0A0A8]" />
            ) : (
              <EyeOff className="w-3 h-3 text-[#A0A0A8]" />
            )}
          </button>
          <button
            onClick={() => onDelete(product._id)}
            className="p-2 hover:bg-red-500/20 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </div>
      </div>
    </Card>
  )
}
