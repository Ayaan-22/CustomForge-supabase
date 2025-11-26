"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useAuthStore } from "@/lib/auth-store"

interface AuthContextType {
  user: any
  loading: boolean
  login: (data: any) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => Promise<void>
  requiresTwoFactor: boolean
  submitTwoFactor: (token: string, email: string, password: string) => Promise<void>
}

import { createContext, useContext } from "react"

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const { user, accessToken, requiresTwoFactor, setRequiresTwoFactor } = useAuthStore()

  const checkAuth = async () => {
    try {
      const response = await authClient.refreshToken()
      if (response.data?.user) {
        useAuthStore.getState().setUser(response.data.user)
        useAuthStore.getState().setToken(response.token)
      }
    } catch (error) {
      useAuthStore.getState().clearAuth()
      if (pathname?.startsWith("/admin")) {
        router.push("/login")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const login = async (data: any) => {
    try {
      const response = await authClient.login(data)

      if (response.data?.user) {
        const userData = response.data.user

        if (userData.role !== "admin") {
          throw new Error("Access denied: Admin role required")
        }

        if (!userData.isEmailVerified) {
          router.push("/verify-email-prompt")
          return
        }
      }

      router.push("/admin/dashboard")
    } catch (err: any) {
      if (err.message === "2FA required") {
        setRequiresTwoFactor(true)
      } else {
        throw err
      }
    }
  }

  const submitTwoFactor = async (twoFactorToken: string, email: string, password: string) => {
    try {
      const response = await authClient.verifyTwoFactorForLogin(email, password, twoFactorToken)

      if (response.data?.user) {
        const userData = response.data.user

        if (userData.role !== "admin") {
          throw new Error("Access denied: Admin role required")
        }

        if (!userData.isEmailVerified) {
          router.push("/verify-email-prompt")
          return
        }
      }

      setRequiresTwoFactor(false)
      router.push("/admin/dashboard")
    } catch (err: any) {
      throw err
    }
  }

  const register = async (data: any) => {
    await authClient.register(data)
    router.push("/login?registered=true")
  }

  const logout = async () => {
    try {
      await authClient.logout()
    } finally {
      router.push("/login")
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        requiresTwoFactor,
        submitTwoFactor,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
