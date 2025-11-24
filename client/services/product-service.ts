import { apiFetch, type ApiResponse } from "@/lib/apiClient"
import type { Product, Review } from "@/lib/types"

export type ProductsQuery = {
  page?: number
  limit?: number
  sort?: string
  category?: string
  search?: string
  minPrice?: number
  maxPrice?: number
  brand?: string
  rating?: number
}

export type ReviewPayload = {
  rating: number
  comment?: string
}

export const ProductService = {
  list(params?: ProductsQuery): Promise<ApiResponse<{ items: Product[]; total?: number }>> {
    return apiFetch("/products", { method: "GET", params })
  },

  top(): Promise<ApiResponse<{ items: Product[] }>> {
    return apiFetch("/products/top", { method: "GET" })
  },

  search(q: string): Promise<ApiResponse<{ items: Product[] }>> {
    return apiFetch("/products/search", { method: "GET", params: { q } })
  },

  categories(): Promise<ApiResponse<{ items: string[] }>> {
    return apiFetch("/products/categories", { method: "GET" })
  },

  featured(): Promise<ApiResponse<{ items: Product[] }>> {
    return apiFetch("/products/featured", { method: "GET" })
  },

  byCategory(category: string): Promise<ApiResponse<{ items: Product[] }>> {
    return apiFetch(`/products/category/${encodeURIComponent(category)}`, { method: "GET" })
  },

  get(id: string): Promise<ApiResponse<{ item: Product }>> {
    return apiFetch(`/products/${encodeURIComponent(id)}`, { method: "GET" })
  },

  related(id: string): Promise<ApiResponse<{ items: Product[] }>> {
    return apiFetch(`/products/${encodeURIComponent(id)}/related`, { method: "GET" })
  },

  addReview(id: string, payload: ReviewPayload): Promise<ApiResponse<{ review: Review }>> {
    return apiFetch(`/products/${encodeURIComponent(id)}/reviews`, { method: "POST", body: payload })
  },

  wishlist(): Promise<ApiResponse<{ items: Product[] }>> {
    return apiFetch("/products/wishlist", { method: "GET" })
  },

  addToWishlist(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch(`/products/${encodeURIComponent(id)}/wishlist`, { method: "POST" })
  },

  removeFromWishlist(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch(`/products/${encodeURIComponent(id)}/wishlist`, { method: "DELETE" })
  },
}
