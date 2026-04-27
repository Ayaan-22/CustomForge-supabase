"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CartService,
  type AddToCartPayload,
  type UpdateItemPayload,
  type CouponPayload,
} from "@/services/cart-service";

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "clear"],
    mutationFn: () => CartService.clear(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useUpdateCartItem(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "update-item", productId],
    mutationFn: (payload: UpdateItemPayload) =>
      CartService.updateItem(productId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "remove-item"],
    mutationFn: (productId: string) => CartService.removeItem(productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "apply-coupon"],
    mutationFn: (payload: CouponPayload) => CartService.applyCoupon(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useRemoveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cart", "remove-coupon"],
    mutationFn: () => CartService.removeCoupon(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}
