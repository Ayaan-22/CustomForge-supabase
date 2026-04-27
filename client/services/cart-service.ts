import { apiFetch, type ApiResponse } from "@/lib/apiClient";
import type { Cart } from "@/lib/types";

export type AddToCartPayload = { productId: string; quantity: number };
export type UpdateItemPayload = { quantity: number };
export type CouponPayload = { code: string };

export const CartService = {
  get(): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch("/cart", { method: "GET" });
  },

  add(payload: AddToCartPayload): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch("/cart/add", { method: "POST", body: payload });
  },

  clear(): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/cart", { method: "DELETE" });
  },

  updateItem(
    productId: string,
    payload: UpdateItemPayload
  ): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch("/cart/update", {
      method: "PATCH",
      body: { productId, ...payload },
    });
  },

  removeItem(productId: string): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch(`/cart/remove/${encodeURIComponent(productId)}`, {
      method: "DELETE",
    });
  },

  applyCoupon(payload: CouponPayload): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch("/cart/coupon", { method: "POST", body: payload });
  },

  removeCoupon(): Promise<ApiResponse<{ cart: Cart }>> {
    return apiFetch("/cart/coupon", { method: "DELETE" });
  },
};
