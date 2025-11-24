"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import type { Product } from "@/lib/types"
import { ProductCard } from "@/components/product-card"
import { FilterSidebar } from "@/components/filter-sidebar"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/apiClient"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ProductsPage() {
  const params = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState(params.get("sort") || "newest")

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      // Build params object from search params
      const apiParams: Record<string, string> = {}
      params.forEach((value, key) => {
        apiParams[key] = value
      })

      const res = await apiFetch<{ items: Product[]; total: number }>("/products", { params: apiParams })

      if (res.data?.items) {
        setProducts(res.data.items)
        // Extract unique categories and brands
        const cats = [...new Set(res.data.items.map((p) => p.category))]
        const brnds = [...new Set(res.data.items.map((p) => p.brand))]
        setCategories(cats)
        setBrands(brnds)
      }
      setLoading(false)
    }
    loadData()
  }, [params])

  const sorted = useMemo(() => {
    const arr = [...products]
    switch (sort) {
      case "price-asc":
        arr.sort((a, b) => (a.finalPrice ?? a.originalPrice) - (b.finalPrice ?? b.originalPrice))
        break
      case "price-desc":
        arr.sort((a, b) => (b.finalPrice ?? b.originalPrice) - (a.finalPrice ?? a.originalPrice))
        break
      case "rating-desc":
        arr.sort((a, b) => (b.ratings?.average ?? 0) - (a.ratings?.average ?? 0))
        break
      case "best-sellers":
        arr.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
        break
      default:
        arr.sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime())
    }
    return arr
  }, [products, sort])

  const handleSortChange = (value: string) => {
    setSort(value)
    const sp = new URLSearchParams(params.toString())
    sp.set("sort", value)
    history.replaceState(null, "", `/products?${sp.toString()}`)
  }

  return (
    <div className="container mx-auto grid gap-6 px-4 py-6 md:grid-cols-[280px_1fr]">
      {loading ? <Skeleton className="h-96 w-full" /> : <FilterSidebar categories={categories} brands={brands} />}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{products.length} results</div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sort" className="text-sm text-muted-foreground">
              Sort
            </Label>
            <Select value={sort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-asc">Price Low→High</SelectItem>
                <SelectItem value="price-desc">Price High→Low</SelectItem>
                <SelectItem value="rating-desc">Rating High→Low</SelectItem>
                <SelectItem value="best-sellers">Best Sellers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No products found.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {sorted.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
