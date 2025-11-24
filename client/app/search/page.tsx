"use client"

import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { fetcher } from "@/lib/api"
import type { Product } from "@/lib/types"
import { ProductCard } from "@/components/product-card"

export default function SearchPage() {
  const params = useSearchParams()
  const q = params.get("q") || ""
  const { data, isLoading } = useSWR<{ items: Product[] }>(`/api/products?q=${encodeURIComponent(q)}`, fetcher)

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="font-heading text-2xl">Search results</h1>
      <p className="text-sm text-muted-foreground">for “{q}”</p>
      {isLoading ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 w-full rounded-md border bg-card/60" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {data?.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
