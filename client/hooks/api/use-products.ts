"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ProductService, type ProductsQuery, type ReviewPayload } from "@/services/product-service"

export function useProducts(params?: ProductsQuery) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => ProductService.list(params).then((r) => r),
    keepPreviousData: true,
  })
}

export function useTopProducts() {
  return useQuery({
    queryKey: ["products", "top"],
    queryFn: () => ProductService.top().then((r) => r),
  })
}

export function useFeaturedProducts() {
  return useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => ProductService.featured().then((r) => r),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: () => ProductService.get(id).then((r) => r),
    enabled: !!id,
  })
}

export function useRelatedProducts(id: string) {
  return useQuery({
    queryKey: ["products", id, "related"],
    queryFn: () => ProductService.related(id).then((r) => r),
    enabled: !!id,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ["products", "categories"],
    queryFn: () => ProductService.categories().then((r) => r),
  })
}

export function useAddReview(productId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["products", productId, "add-review"],
    mutationFn: (payload: ReviewPayload) => ProductService.addReview(productId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", productId] })
      qc.invalidateQueries({ queryKey: ["products", productId, "related"] })
    },
  })
}

export function useWishlistProducts() {
  return useQuery({
    queryKey: ["products", "wishlist"],
    queryFn: () => ProductService.wishlist().then((r) => r),
  })
}

export function useToggleWishlist(productId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["products", productId, "wishlist"],
    mutationFn: async () => {
      // simple toggle: try add then remove on 409/400
      const add = await ProductService.addToWishlist(productId)
      if (add.error && add.status >= 400) {
        const rem = await ProductService.removeFromWishlist(productId)
        return rem
      }
      return add
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", "wishlist"] })
    },
  })
}
