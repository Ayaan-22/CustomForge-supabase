"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserService, type UpdateMePayload } from "@/services/user-service"

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => UserService.me().then((r) => r),
    staleTime: 30_000,
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["users", "update-me"],
    mutationFn: (payload: UpdateMePayload) => UserService.updateMe(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
    },
  })
}

export function useDeleteMe() {
  return useMutation({
    mutationKey: ["users", "delete-me"],
    mutationFn: () => UserService.deleteMe(),
  })
}

export function useWishlist() {
  return useQuery({
    queryKey: ["wishlist"],
    queryFn: () => UserService.wishlist().then((r) => r),
  })
}

export function useMyOrders() {
  return useQuery({
    queryKey: ["orders", "mine"],
    queryFn: () => UserService.orders().then((r) => r),
    refetchOnWindowFocus: false,
  })
}
