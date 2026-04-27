import { apiFetch, type ApiResponse } from "@/lib/apiClient";
import type { PaymentIntent, PaymentMethod, Order } from "@/lib/types";

export type ProcessPaymentPayload = {
  orderId: string;
  paymentMethod: "stripe" | "paypal" | "cod";
  paymentData?: any;
};

export type CreateIntentPayload = {
  orderId: string;
};

export type CreateStripeSessionPayload = {
  orderId: string;
};

export type CreateOrderCodPayload = {
  orderId: string;
};

export type CreatePayPalOrderPayload = {
  orderId: string;
};

export type CapturePayPalOrderPayload = {
  orderId: string;
  paypalOrderId: string;
};

export type SavePaymentMethodPayload = {
  paymentMethodId: string;
};

export const PaymentService = {
  // Generic process payment (for Stripe client-side confirmation flow)
  process(
    payload: ProcessPaymentPayload
  ): Promise<ApiResponse<{ message: string; data: Order }>> {
    return apiFetch("/payment/process", { method: "POST", body: payload });
  },

  // Stripe: Create Payment Intent (Client-side flow)
  createIntent(
    payload: CreateIntentPayload
  ): Promise<ApiResponse<{ clientSecret: string; paymentIntentId: string }>> {
    return apiFetch("/payment/create-intent", {
      method: "POST",
      body: payload,
    });
  },

  // Stripe: Create Checkout Session (Server-side flow)
  createStripeSession(
    payload: CreateStripeSessionPayload
  ): Promise<ApiResponse<{ sessionId: string; url: string }>> {
    return apiFetch("/payment/create-stripe-session", {
      method: "POST",
      body: payload,
    });
  },

  // COD: Create COD Order
  createOrderCod(
    payload: CreateOrderCodPayload
  ): Promise<ApiResponse<{ message: string; data: Order }>> {
    return apiFetch("/payment/create-order-cod", {
      method: "POST",
      body: payload,
    });
  },

  // PayPal: Create Order
  createPayPalOrder(
    payload: CreatePayPalOrderPayload
  ): Promise<ApiResponse<{ paypalOrderId: string; message: string }>> {
    return apiFetch("/payment/paypal/create-order", {
      method: "POST",
      body: payload,
    });
  },

  // PayPal: Capture Order
  capturePayPalOrder(
    payload: CapturePayPalOrderPayload
  ): Promise<ApiResponse<{ message: string; data: Order }>> {
    return apiFetch("/payment/paypal/capture-order", {
      method: "POST",
      body: payload,
    });
  },

  // Payment Methods: Get Saved
  getPaymentMethods(): Promise<ApiResponse<PaymentMethod[]>> {
    return apiFetch("/payment/payment-methods", { method: "GET" });
  },

  // Payment Methods: Save New
  savePaymentMethod(
    payload: SavePaymentMethodPayload
  ): Promise<ApiResponse<{ message: string; data: PaymentMethod }>> {
    return apiFetch("/payment/payment-methods", {
      method: "POST",
      body: payload,
    });
  },

  // Payment Methods: Remove
  removePaymentMethod(
    paymentMethodId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return apiFetch(
      `/payment/payment-methods/${encodeURIComponent(paymentMethodId)}`,
      {
        method: "DELETE",
      }
    );
  },

  // Webhook (mostly for testing/reference)
  webhook(payload: any): Promise<ApiResponse<{ received: boolean }>> {
    return apiFetch("/payment/webhook", { method: "POST", body: payload });
  },
};
