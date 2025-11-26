"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { X, Plus, Trash2 } from "lucide-react"

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

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (product: any) => void
  initialData?: any
  isEditing?: boolean
}

export function ProductModal({ isOpen, onClose, onSubmit, initialData, isEditing }: ProductModalProps) {
  const [formData, setFormData] = useState(
    initialData || {
      name: "",
      sku: "",
      category: "CPU",
      brand: "",
      description: "",
      originalPrice: "",
      discountPercentage: 0,
      stock: "",
      images: [],
      specifications: [],
      features: [],
      warranty: "1 year limited warranty",
      weight: "",
      dimensions: { length: "", width: "", height: "" },
      isActive: true,
      isFeatured: false,
    },
  )

  const [newImage, setNewImage] = useState("")
  const [newSpec, setNewSpec] = useState({ key: "", value: "" })
  const [newFeature, setNewFeature] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleDimensionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev: any) => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        [name]: value,
      },
    }))
  }

  const addImage = () => {
    if (newImage.trim()) {
      setFormData((prev: any) => ({
        ...prev,
        images: [...prev.images, newImage],
      }))
      setNewImage("")
    }
  }

  const removeImage = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      images: prev.images.filter((_: any, i: number) => i !== index),
    }))
  }

  const addSpecification = () => {
    if (newSpec.key.trim() && newSpec.value.trim()) {
      setFormData((prev: any) => ({
        ...prev,
        specifications: [...prev.specifications, newSpec],
      }))
      setNewSpec({ key: "", value: "" })
    }
  }

  const removeSpecification = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      specifications: prev.specifications.filter((_: any, i: number) => i !== index),
    }))
  }

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData((prev: any) => ({
        ...prev,
        features: [...prev.features, newFeature],
      }))
      setNewFeature("")
    }
  }

  const removeFeature = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      features: prev.features.filter((_: any, i: number) => i !== index),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert("Product name is required")
      return
    }
    if (!formData.sku.trim()) {
      alert("SKU is required")
      return
    }
    if (!formData.brand.trim()) {
      alert("Brand is required")
      return
    }
    if (!formData.description.trim()) {
      alert("Description is required")
      return
    }
    if (formData.images.length === 0) {
      alert("At least one image is required")
      return
    }
    if (!formData.originalPrice) {
      alert("Original price is required")
      return
    }
    if (formData.stock === "") {
      alert("Stock quantity is required")
      return
    }

    const finalPrice = Number.parseFloat(formData.originalPrice) * (1 - formData.discountPercentage / 100)

    const submitData = {
      ...formData,
      originalPrice: Number.parseFloat(formData.originalPrice),
      discountPercentage: Number.parseFloat(formData.discountPercentage),
      finalPrice: Number.parseFloat(finalPrice.toFixed(2)),
      stock: Number.parseInt(formData.stock),
      weight: formData.weight ? Number.parseFloat(formData.weight) : undefined,
      dimensions: {
        length: formData.dimensions.length ? Number.parseFloat(formData.dimensions.length) : undefined,
        width: formData.dimensions.width ? Number.parseFloat(formData.dimensions.width) : undefined,
        height: formData.dimensions.height ? Number.parseFloat(formData.dimensions.height) : undefined,
      },
    }

    onSubmit(submitData)

    setFormData({
      name: "",
      sku: "",
      category: "CPU",
      brand: "",
      description: "",
      originalPrice: "",
      discountPercentage: 0,
      stock: "",
      images: [],
      specifications: [],
      features: [],
      warranty: "1 year limited warranty",
      weight: "",
      dimensions: { length: "", width: "", height: "" },
      isActive: true,
      isFeatured: false,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <Card className="glass-dark border-[#2A2A35] w-full max-w-4xl mx-4 my-8 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">{isEditing ? "Edit Product" : "Add New Product"}</h2>
          <button onClick={onClose} className="text-[#A0A0A8] hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Product Name *</label>
              <Input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter product name"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
                maxLength={100}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">SKU *</label>
              <Input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Enter SKU"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
                disabled={isEditing}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
                required
              >
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Brand *</label>
              <Input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="Enter brand"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter product description"
              className="w-full px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg resize-none"
              rows={4}
              maxLength={2000}
              required
            />
            <p className="text-xs text-[#A0A0A8] mt-1">{formData.description.length}/2000</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Original Price *</label>
              <Input
                type="number"
                name="originalPrice"
                value={formData.originalPrice}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Discount %</label>
              <Input
                type="number"
                name="discountPercentage"
                value={formData.discountPercentage}
                onChange={handleChange}
                placeholder="0"
                min="0"
                max="100"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Stock *</label>
              <Input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                placeholder="0"
                min="0"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Images * (at least one required)</label>
            <div className="flex gap-2 mb-3">
              <Input
                type="text"
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
                placeholder="Enter image URL"
                className="bg-[#1F1F28] border-[#2A2A35] text-white flex-1"
              />
              <Button type="button" onClick={addImage} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {formData.images.map((img: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#1F1F28] p-3 rounded-lg border border-[#2A2A35]"
                >
                  <span className="text-sm text-[#A0A0A8] truncate">{img}</span>
                  <button type="button" onClick={() => removeImage(idx)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Specifications</label>
            <div className="flex gap-2 mb-3">
              <Input
                type="text"
                value={newSpec.key}
                onChange={(e) => setNewSpec({ ...newSpec, key: e.target.value })}
                placeholder="Key (e.g., Processor)"
                className="bg-[#1F1F28] border-[#2A2A35] text-white flex-1"
              />
              <Input
                type="text"
                value={newSpec.value}
                onChange={(e) => setNewSpec({ ...newSpec, value: e.target.value })}
                placeholder="Value (e.g., Intel i9)"
                className="bg-[#1F1F28] border-[#2A2A35] text-white flex-1"
              />
              <Button type="button" onClick={addSpecification} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {formData.specifications.map((spec: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#1F1F28] p-3 rounded-lg border border-[#2A2A35]"
                >
                  <span className="text-sm text-[#A0A0A8]">
                    <strong>{spec.key}:</strong> {spec.value}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSpecification(idx)}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Features</label>
            <div className="flex gap-2 mb-3">
              <Input
                type="text"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder="Enter feature"
                className="bg-[#1F1F28] border-[#2A2A35] text-white flex-1"
              />
              <Button type="button" onClick={addFeature} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {formData.features.map((feature: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#1F1F28] p-3 rounded-lg border border-[#2A2A35]"
                >
                  <span className="text-sm text-[#A0A0A8]">{feature}</span>
                  <button type="button" onClick={() => removeFeature(idx)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Warranty</label>
              <Input
                type="text"
                name="warranty"
                value={formData.warranty}
                onChange={handleChange}
                placeholder="e.g., 1 year limited warranty"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Weight (kg)</label>
              <Input
                type="number"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Dimensions</label>
            <div className="grid grid-cols-3 gap-4">
              <Input
                type="number"
                name="length"
                value={formData.dimensions.length}
                onChange={handleDimensionChange}
                placeholder="Length (cm)"
                step="0.01"
                min="0"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
              />
              <Input
                type="number"
                name="width"
                value={formData.dimensions.width}
                onChange={handleDimensionChange}
                placeholder="Width (cm)"
                step="0.01"
                min="0"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
              />
              <Input
                type="number"
                name="height"
                value={formData.dimensions.height}
                onChange={handleDimensionChange}
                placeholder="Height (cm)"
                step="0.01"
                min="0"
                className="bg-[#1F1F28] border-[#2A2A35] text-white"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-4 h-4"
              />
              <span className="text-sm text-[#A0A0A8]">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isFeatured"
                checked={formData.isFeatured}
                onChange={handleChange}
                className="w-4 h-4"
              />
              <span className="text-sm text-[#A0A0A8]">Featured</span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-[#2A2A35]">
            <Button type="button" onClick={onClose} className="bg-[#2A2A35] text-white hover:bg-[#3A3A45]">
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] hover:shadow-lg hover:shadow-purple-500/20"
            >
              {isEditing ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
