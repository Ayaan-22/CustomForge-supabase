import { apiFetch, type ApiResponse } from "@/lib/apiClient"
import type { Order } from "@/lib/types"

export type CreateOrderPayload = {
  items: Array<{ productId: string; quantity: number }>
  addressId?: string
  paymentMethodId?: string
  notes?: string
}

export const OrderService = {
  create(payload: CreateOrderPayload): Promise<ApiResponse<{ order: Order }>> {
    return apiFetch("/orders", { method: "POST", body: payload })
  },

  list(): Promise<ApiResponse<{ items: Order[] }>> {
    return apiFetch("/orders", { method: "GET" })
  },

  get(id: string): Promise<ApiResponse<{ order: Order }>> {
    return apiFetch(`/orders/${encodeURIComponent(id)}`, { method: "GET" })
  },

  paymentStatus(id: string): Promise<ApiResponse<{ status: "pending" | "paid" | "failed" }>> {
    return apiFetch(`/orders/${encodeURIComponent(id)}/payment-status`, { method: "GET" })
  },

  cancel(id: string): Promise<ApiResponse<{ order: Order }>> {
    return apiFetch(`/orders/${encodeURIComponent(id)}/cancel`, { method: "PUT" })
  },

  return(id: string): Promise<ApiResponse<{ order: Order }>> {
    return apiFetch(`/orders/${encodeURIComponent(id)}/return`, { method: "POST" })
  },
}
