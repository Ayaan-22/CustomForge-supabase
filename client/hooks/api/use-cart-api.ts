"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CartService,
  type AddToCartPayload,
  type UpdateItemPayload,
  type CouponPayload,
} from "@/services/cart-service";
import { showError, showSuccess } from "@/lib/toast-utils";

export function useServerCart() {
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => CartService.get().then((r) => r),
    refetchOnWindowFocus: false,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "add"],
    mutationFn: (payload: AddToCartPayload) => CartService.add(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      showSuccess("Item added to cart");
    },
    onError: (error: any) =>
      showError(error?.message || "Failed to add to cart"),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "clear"],
    mutationFn: () => CartService.clear(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      showSuccess("Cart cleared");
    },
    onError: (error: any) =>
      showError(error?.message || "Failed to clear cart"),
  });
}

export function useUpdateCartItem(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "update-item", productId],
    mutationFn: (payload: UpdateItemPayload) =>
      CartService.updateItem(productId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
    onError: (error: any) =>
      showError(error?.message || "Failed to update item"),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "remove-item"],
    mutationFn: (productId: string) => CartService.removeItem(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      showSuccess("Item removed from cart");
    },
    onError: (error: any) =>
      showError(error?.message || "Failed to remove item"),
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "apply-coupon"],
    mutationFn: (payload: CouponPayload) => CartService.applyCoupon(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      showSuccess("Coupon applied");
    },
    onError: (error: any) =>
      showError(error?.message || "Failed to apply coupon"),
  });
}

export function useRemoveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "remove-coupon"],
    mutationFn: () => CartService.removeCoupon(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      showSuccess("Coupon removed");
    },
    onError: (error: any) =>
      showError(error?.message || "Failed to remove coupon"),
  });
}
