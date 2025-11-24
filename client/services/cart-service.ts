import { apiFetch, type ApiResponse } from "@/lib/apiClient"
import type { Cart } from "@/lib/types"

export type SetCartPayload = { items: Array<{ productId: string; quantity: number }> }
export type UpdateItemPayload = { quantity: number }
export type CouponPayload = { code: string }

export const CartService = {
  get(): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch("/cart", { method: "GET" })
  },

  set(payload: SetCartPayload): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch("/cart", { method: "POST", body: payload })
  },

  clear(): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/cart", { method: "DELETE" })
  },

  updateItem(productId: string, payload: UpdateItemPayload): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch(`/cart/${encodeURIComponent(productId)}`, { method: "PATCH", body: payload })
  },

  removeItem(productId: string): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch(`/cart/${encodeURIComponent(productId)}`, { method: "DELETE" })
  },

  applyCoupon(payload: CouponPayload): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch("/cart/coupon", { method: "POST", body: payload })
  },

  removeCoupon(): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch("/cart/coupon", { method: "DELETE" })
  },
}
