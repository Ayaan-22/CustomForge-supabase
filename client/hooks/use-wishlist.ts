"use client"

import useSWR from "swr"
import type { Product } from "@/lib/types"

type WishlistState = { items: Product[] }
const KEY = "cf-wishlist"

function load(): WishlistState {
  if (typeof window === "undefined") return { items: [] }
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : { items: [] }
  } catch {
    return { items: [] }
  }
}

function save(state: WishlistState) {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function useWishlist() {
  const { data, mutate } = useSWR<WishlistState>(KEY, () => load(), { fallbackData: { items: [] } })
  const items = data!.items

  function set(next: WishlistState) {
    save(next)
    mutate(next, false)
  }

  function toggle(p: Product) {
    const exists = items.some((x) => x.id === p.id)
    if (exists) set({ items: items.filter((x) => x.id !== p.id) })
    else set({ items: [...items, p] })
  }

  return { items, toggle }
}
