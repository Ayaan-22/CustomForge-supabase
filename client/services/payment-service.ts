import { apiFetch, type ApiResponse } from "@/lib/apiClient"
import type { PaymentIntent, PaymentMethod } from "@/lib/types"

export type ProcessPaymentPayload = {
  orderId: string
  paymentMethodId: string
}

export type CreateIntentPayload = {
  amount: number
  currency: string
  orderId: string
}

export type WebhookPayload = unknown

export type SavePaymentMethodPayload = {
  type: "card"
  token: string
}

export const PaymentService = {
  webhook(payload: WebhookPayload): Promise<ApiResponse<{ received: boolean }>> {
    // Usually called server-side, exposed for completeness
    return apiFetch("/payment/webhook", { method: "POST", body: payload })
  },

  process(payload: ProcessPaymentPayload): Promise<ApiResponse<{ status: "succeeded" | "failed" }>> {
    return apiFetch("/payment/process", { method: "POST", body: payload })
  },

  createIntent(payload: CreateIntentPayload): Promise<ApiResponse<{ intent: PaymentIntent }>> {
    return apiFetch("/payment/create-intent", { method: "POST", body: payload })
  },

  getPaymentMethods(): Promise<ApiResponse<{ items: PaymentMethod[] }>> {
    return apiFetch("/payment/payment-methods", { method: "GET" })
  },

  addPaymentMethod(payload: SavePaymentMethodPayload): Promise<ApiResponse<{ method: PaymentMethod }>> {
    return apiFetch("/payment/payment-methods", { method: "POST", body: payload })
  },
}
