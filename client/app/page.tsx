"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CategoryCard } from "@/components/category-card"
import { ProductCard } from "@/components/product-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Product } from "@/lib/types"
import { apiFetch } from "@/lib/apiClient"

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProducts() {
      console.log("[v0] HomePage: Fetching products...")
      const res = await apiFetch<{ items: Product[] }>("/products")
      console.log("[v0] HomePage: Response:", res)
      if (res.data?.items) {
        setProducts(res.data.items)
      }
      setLoading(false)
    }
    loadProducts()
  }, [])

  const featured = products.filter((p) => p.isFeatured).slice(0, 8)
  const newArrivals = [...products]
    .sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime())
    .slice(0, 8)
  const bestSellers = [...products].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 8)

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative">
        <div className="container mx-auto grid items-center gap-6 px-4 py-12 md:grid-cols-2">
          <div>
            <h1 className="font-heading text-balance text-4xl md:text-5xl">Forge Your Ultimate Rig</h1>
            <p className="mt-3 text-muted-foreground">
              Premium GPUs, CPUs, peripherals, and software curated for peak performance.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/products">
                <Button>Shop Now</Button>
              </Link>
              <Link href="/products?category=Prebuilt">
                <Button variant="secondary">Prebuilt PCs</Button>
              </Link>
            </div>
          </div>
          <div className="rounded-xl border bg-card/60 p-2">
            <img
              src="/custom-gaming-pc-with-rgb-lighting.jpg"
              alt="Custom gaming PC"
              className="h-full w-full rounded-md object-cover"
              crossOrigin="anonymous"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4">
        <h2 className="font-heading text-2xl">Top Categories</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <CategoryCard name="GPUs" href="/products?category=GPU" image="/graphics-card-gpu.jpg" />
          <CategoryCard name="CPUs" href="/products?category=CPU" image="/processor-cpu-chip.jpg" />
          <CategoryCard name="Peripherals" href="/products?category=Peripherals" image="/gaming-keyboard-mouse.jpg" />
          <CategoryCard name="Storage" href="/products?category=Storage" image="/ssd-nvme-storage.jpg" />
        </div>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl">Featured</h2>
          <Link href="/products" className="text-sm text-primary">
            View all
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-48 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            : featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="container mx-auto px-4">
        <h2 className="font-heading text-2xl">New Arrivals</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-48 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            : newArrivals.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Best Sellers */}
      <section className="container mx-auto px-4">
        <h2 className="font-heading text-2xl">Best Sellers</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-48 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            : bestSellers.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  )
}
