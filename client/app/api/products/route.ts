import type { NextRequest } from "next/server"
import { MOCK_PRODUCTS } from "./data"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") || "").toLowerCase()
  const category = url.searchParams.get("category") || ""
  const brand = url.searchParams.get("brand") || ""
  const minPrice = Number(url.searchParams.get("minPrice") || "0")
  const maxPrice = Number(url.searchParams.get("maxPrice") || "100000")
  const rating = Number(url.searchParams.get("rating") || "0")

  const items = MOCK_PRODUCTS.filter((p) => {
    const matchesQ =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
    const matchesCategory = !category || p.category === category
    const matchesBrand = !brand || p.brand === brand
    const price = p.discountPercentage ? p.originalPrice * (1 - p.discountPercentage / 100) : p.originalPrice
    const matchesPrice = price >= minPrice && price <= maxPrice
    const matchesRating = p.ratings.average >= rating
    return matchesQ && matchesCategory && matchesBrand && matchesPrice && matchesRating
  })

  const categories = Array.from(new Set(MOCK_PRODUCTS.map((p) => p.category)))
  const brands = Array.from(new Set(MOCK_PRODUCTS.map((p) => p.brand)))

  return Response.json({ items, categories, brands })
}
