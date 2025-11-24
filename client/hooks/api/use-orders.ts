"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { OrderService, type CreateOrderPayload } from "@/services/order-service"
import {
  PaymentService,
  type CreateIntentPayload,
  type ProcessPaymentPayload,
  type SavePaymentMethodPayload,
} from "@/services/payment-service"

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => OrderService.list().then((r) => r),
    refetchOnWindowFocus: false,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: () => OrderService.get(id).then((r) => r),
    enabled: !!id,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["orders", "create"],
    mutationFn: (payload: CreateOrderPayload) => OrderService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  })
}

export function usePaymentStatus(orderId: string) {
  return useQuery({
    queryKey: ["orders", orderId, "payment-status"],
    queryFn: () => OrderService.paymentStatus(orderId).then((r) => r),
    enabled: !!orderId,
    refetchInterval: 5000,
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["orders", "cancel"],
    mutationFn: (orderId: string) => OrderService.cancel(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  })
}

export function useReturnOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["orders", "return"],
    mutationFn: (orderId: string) => OrderService.return(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  })
}

// Payment

export function useCreatePaymentIntent() {
  return useMutation({
    mutationKey: ["payment", "create-intent"],
    mutationFn: (payload: CreateIntentPayload) => PaymentService.createIntent(payload),
  })
}

export function useProcessPayment() {
  return useMutation({
    mutationKey: ["payment", "process"],
    mutationFn: (payload: ProcessPaymentPayload) => PaymentService.process(payload),
  })
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => PaymentService.getPaymentMethods().then((r) => r),
  })
}

export function useAddPaymentMethod() {
  return useMutation({
    mutationKey: ["payment-methods", "add"],
    mutationFn: (payload: SavePaymentMethodPayload) => PaymentService.addPaymentMethod(payload),
  })
}
