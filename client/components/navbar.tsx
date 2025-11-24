"use client"

import type React from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ShoppingCart, User, Heart, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCart } from "@/hooks/use-cart"
import { useState } from "react"
import { cn } from "@/lib/utils"
import useSWR from "swr"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { AuthService } from "@/services/auth-service"

export function Navbar() {
  const { count } = useCart()
  const [q, setQ] = useState("")
  const router = useRouter()
  const pathname = usePathname()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/search?q=${encodeURIComponent(q)}`)
    setQ("")
  }

  const { data: me } = useSWR(
    "/api/v1/users/me",
    async (url) => {
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error("unauthenticated")
      return res.json()
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  async function handleLogout() {
    try {
      await AuthService.logout()
      router.refresh()
      router.push("/")
    } catch (err) {
      // no-op: mock/local only
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className={cn("text-xl font-heading", "tracking-wide")}>CustomForge</span>
        </Link>

        <form onSubmit={submit} className="hidden md:flex relative w-full max-w-xl items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search components, games, accessories..."
            className="pl-10"
          />
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden />
        </form>

        <nav className="ml-auto flex items-center gap-2">
          <Link href="/wishlist" aria-label="Wishlist">
            <Button variant="ghost" size="icon">
              <Heart className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/cart" aria-label="Cart" className="relative">
            <Button variant="ghost" size="icon">
              <ShoppingCart className="h-5 w-5" />
            </Button>
            {count > 0 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{me?.user?.name ? me.user.name.split(" ")[0] : "Account"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="min-w-48 bg-popover/90 text-popover-foreground backdrop-blur supports-[backdrop-filter]:bg-popover/80 border border-border"
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {me?.user ? "Your account" : "Welcome to CustomForge"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {me?.user ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/edit">Edit Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/addresses">Addresses</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/payment-methods">Payment Methods</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/wishlist">Wishlist</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/orders">Orders</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile/security">Security & 2FA</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/login">Sign in</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/register">Create account</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>

      {/* Mobile search */}
      {pathname !== "/search" && (
        <div className="block md:hidden border-t px-4 py-2">
          <form onSubmit={submit} className="relative">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search CustomForge..."
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          </form>
        </div>
      )}
    </header>
  )
}
