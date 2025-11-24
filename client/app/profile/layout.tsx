"use client"

import type React from "react"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  const { data: me, error } = useSWR(
    "/api/v1/users/me",
    async (url) => {
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error("unauthenticated")
      return res.json()
    },
    { revalidateOnFocus: false },
  )

  useEffect(() => {
    if (error) {
      router.push("/login?redirect=/profile")
    }
    if (me) {
      setChecking(false)
    }
  }, [me, error, router])

  if (checking || error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  return children
}
