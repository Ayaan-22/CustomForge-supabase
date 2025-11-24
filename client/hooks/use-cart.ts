"use client"

import useSWR from "swr"
import type { Product } from "@/lib/types"

type CartItem = { product: Product; quantity: number }
type CartState = { items: CartItem[] }

const KEY = "cf-cart"

function load(): CartState {
  if (typeof window === "undefined") return { items: [] }
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : { items: [] }
  } catch {
    return { items: [] }
  }
}

function save(state: CartState) {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function useCart() {
  const { data, mutate } = useSWR<CartState>(KEY, () => load(), { fallbackData: { items: [] } })

  const items = data!.items
  const count = items.reduce((acc, it) => acc + it.quantity, 0)
  const subtotal = items.reduce(
    (acc, it) =>
      acc +
      it.quantity *
        (it.product.discountPercentage
          ? it.product.originalPrice * (1 - it.product.discountPercentage / 100)
          : it.product.originalPrice),
    0,
  )

  function set(next: CartState) {
    save(next)
    mutate(next, false)
  }

  function addItem(product: Product, qty = 1) {
    const existing = items.find((i) => i.product.id === product.id)
    if (existing) {
      set({ items: items.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i)) })
    } else {
      set({ items: [...items, { product, quantity: qty }] })
    }
  }

  function removeItem(id: string) {
    set({ items: items.filter((i) => i.product.id !== id) })
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) return removeItem(id)
    set({ items: items.map((i) => (i.product.id === id ? { ...i, quantity: qty } : i)) })
  }

  function clear() {
    set({ items: [] })
  }

  return { items, count, subtotal, addItem, removeItem, updateQty, clear }
}
