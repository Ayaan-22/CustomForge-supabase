import productsJson from "@/mock/products.json" assert { type: "json" }
import type { Product } from "@/lib/types"
import { crypto } from "crypto"

function normalize(json: any): import("@/lib/types").Product {
  const priceRaw = typeof json.price === "number" ? json.price : json.originalPrice
  const originalPrice = typeof priceRaw === "number" && priceRaw > 1000 ? priceRaw / 100 : Number(priceRaw || 0)
  const discountPercentage = typeof json.discountPercentage === "number" ? json.discountPercentage : 0
  const finalPrice = Number((originalPrice * (1 - discountPercentage / 100)).toFixed(2))
  const stock = Number(json.stock ?? json.quantity ?? 0)
  const availability: import("@/lib/types").Product["availability"] =
    stock > 0 ? "In Stock" : json.availability === "Preorder" ? "Preorder" : "Out of Stock"

  // coerce specifications into [{key,value}]
  let specifications: Array<{ key: string; value: string }> | undefined
  if (Array.isArray(json.specifications)) {
    specifications = json.specifications
      .filter((s: any) => s && s.key && s.value)
      .map((s: any) => ({ key: String(s.key), value: String(s.value) }))
  } else if (json.specs || json.specifications) {
    const rec = json.specs || json.specifications
    specifications = Object.entries(rec).map(([k, v]) => ({ key: String(k), value: String(v) }))
  }

  const images =
    Array.isArray(json.images) && json.images.length > 0 ? json.images : [json.image || "/gaming-product-image.jpg"]

  return {
    id: String(json.id ?? json._id ?? json.sku ?? crypto.randomUUID()),
    name: String(json.name),
    brand: String(json.brand || "Unknown"),
    category: String(json.category || "Misc"),
    sku: String(json.sku ?? json.slug ?? json.id ?? ""),
    originalPrice,
    discountPercentage,
    finalPrice,
    stock,
    availability,
    warranty: json.warranty || "1 year limited warranty",
    isFeatured: Boolean(json.featured ?? json.isFeatured),
    isActive: json.isActive ?? true,
    createdAt: json.createdAt || new Date().toISOString(),
    updatedAt: json.updatedAt || new Date().toISOString(),
    salesCount: Number(json.salesCount ?? 0),
    ratings: {
      average: Number(json.ratings?.average ?? json.rating ?? 0),
      totalReviews: Number(json.ratings?.totalReviews ?? json.reviewsCount ?? 0),
    },
    images,
    description: String(json.description || "High-performance component for gamers and creators."),
    specifications,
    features: Array.isArray(json.features) ? json.features.map((f: any) => String(f)) : [],
    weight: typeof json.weight === "number" ? json.weight : undefined,
    dimensions: json.dimensions
      ? {
          length: typeof json.dimensions.length === "number" ? json.dimensions.length : undefined,
          width: typeof json.dimensions.width === "number" ? json.dimensions.width : undefined,
          height: typeof json.dimensions.height === "number" ? json.dimensions.height : undefined,
        }
      : undefined,
  }
}

export const MOCK_PRODUCTS: Product[] = (productsJson as any[]).map(normalize)

// Helper to retrieve a product by id for reuse in route handlers
export function getMockProductById(id: string) {
  return MOCK_PRODUCTS.find((p) => p.id === id)
}
