/**
 * Auth Client for CustomForge
 * Handles all authentication related API requests to /api/v1/auth endpoints
 */

import { useAuthStore } from "./auth-store"

const AUTH_API_BASE = "http://localhost:5000/api/v1/auth"
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API !== "true" // Default to true if not explicitly false

export const authClient = {
  // Public Auth Routes
  register: async (data: unknown) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate latency
      return { message: "Registration successful" }
    }

    const response = await fetch(`${AUTH_API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include", // Added credentials to handle cookies
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Registration failed")
    }
    return response.json()
  },

  login: async (data: { email: string; password: string; twoFactorToken?: string }) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const mockAuth = await fetch("/mock/auth.json").then((res) => res.json())
      useAuthStore.getState().setToken(mockAuth.token)
      useAuthStore.getState().setUser(mockAuth.user)
      return mockAuth
    }

    const response = await fetch(`${AUTH_API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    })

    if (!response.ok) {
      if (response.status === 401 && response.headers.get("x-2fa-required")) {
        useAuthStore.getState().setRequiresTwoFactor(true)
        throw new Error("2FA required")
      }
      const error = await response.json()
      throw new Error(error.message || "Login failed")
    }

    const result = await response.json()
    useAuthStore.getState().setToken(result.token)
    useAuthStore.getState().setUser(result.data.user)
    return result
  },

  logout: async () => {
    if (USE_MOCK_API) {
      useAuthStore.getState().clearAuth()
      return { message: "Logged out successfully" }
    }

    const token = useAuthStore.getState().accessToken
    const response = await fetch(`${AUTH_API_BASE}/logout`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    })

    useAuthStore.getState().clearAuth()

    if (!response.ok) throw new Error("Logout failed")
    return response.json()
  },

  verifyEmail: async (token: string) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return { message: "Email verified successfully" }
    }

    const response = await fetch(`${AUTH_API_BASE}/verify-email/${token}`, {
      credentials: "include", // Added credentials to handle cookies
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Email verification failed")
    }
    return response.json()
  },

  sendVerificationEmail: async () => {
    if (USE_MOCK_API) {
      return { message: "Verification email sent" }
    }

    const response = await fetch(`${AUTH_API_BASE}/send-verification-email`, {
      method: "POST",
      credentials: "include", // Added credentials to handle cookies
    })
    if (!response.ok) throw new Error("Failed to send verification email")
    return response.json()
  },

  forgotPassword: async (email: string) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return { message: "Password reset email sent" }
    }

    const response = await fetch(`${AUTH_API_BASE}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include", // Added credentials to handle cookies
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to process forgot password request")
    }
    return response.json()
  },

  resetPassword: async (token: string, password: string) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return { message: "Password reset successful" }
    }

    const response = await fetch(`${AUTH_API_BASE}/reset-password/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include", // Added credentials to handle cookies
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Password reset failed")
    }
    return response.json()
  },

  // Protected Routes
  refreshToken: async () => {
    if (USE_MOCK_API) {
      const session = useAuthStore.getState().user
      if (session) {
        return { token: "mock_refreshed_token", data: { user: session } }
      }
      throw new Error("No session")
    }

    const response = await fetch(`${AUTH_API_BASE}/refresh`, {
      method: "POST",
      credentials: "include",
    })

    if (!response.ok) throw new Error("Token refresh failed")

    const result = await response.json()
    useAuthStore.getState().setToken(result.token)
    return result
  },

  updatePassword: async (data: unknown) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return { message: "Password updated successfully" }
    }

    const response = await fetch(`${AUTH_API_BASE}/update-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include", // Added credentials to handle cookies
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Password update failed")
    }
    return response.json()
  },

  // 2FA Routes
  enableTwoFactor: async () => {
    if (USE_MOCK_API) {
      return {
        qrCode: "mock_qr_code_url",
        secret: "mock_secret_key",
      }
    }

    const response = await fetch(`${AUTH_API_BASE}/2fa/enable`, {
      method: "POST",
      credentials: "include", // Added credentials to handle cookies
    })
    if (!response.ok) throw new Error("Failed to enable 2FA")
    return response.json()
  },

  verifyTwoFactor: async (token: string) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return { verified: true }
    }

    const response = await fetch(`${AUTH_API_BASE}/2fa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "include", // Added credentials to handle cookies
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "2FA verification failed")
    }
    return response.json()
  },

  disableTwoFactor: async (token: string) => {
    if (USE_MOCK_API) {
      return { message: "2FA disabled" }
    }

    const response = await fetch(`${AUTH_API_BASE}/2fa/disable`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "include", // Added credentials to handle cookies
    })
    if (!response.ok) throw new Error("Failed to disable 2FA")
    return response.json()
  },

  verifyTwoFactorForLogin: async (email: string, password: string, twoFactorToken: string) => {
    return authClient.login({ email, password, twoFactorToken })
  },
}
