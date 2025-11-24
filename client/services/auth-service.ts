import { apiFetch, type ApiResponse } from "@/lib/apiClient"
import type { User } from "@/lib/types"

export type RegisterPayload = {
  name: string
  email: string
  password: string
}

export type LoginPayload = {
  email: string
  password: string
  otp?: string
}

export type ForgotPasswordPayload = { email: string }

export type ResetPasswordPayload = {
  password: string
  confirmPassword: string
}

export type UpdatePasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export type Enable2FAPayload = { method: "app" | "sms"; phone?: string }
export type Verify2FAPayload = { code: string }

export const AuthService = {
  health(): Promise<ApiResponse<{ status: string }>> {
    return apiFetch("/health")
  },

  register(payload: RegisterPayload): Promise<ApiResponse<{ user: User }>> {
    return apiFetch("/auth/register", { method: "POST", body: payload })
  },

  login(payload: LoginPayload): Promise<ApiResponse<{ user: User }>> {
    return apiFetch("/auth/login", { method: "POST", body: payload })
  },

  logout(): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/logout", { method: "GET" })
  },

  verifyEmail(token: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch(`/auth/verify-email/${encodeURIComponent(token)}`, { method: "GET" })
  },

  forgotPassword(payload: ForgotPasswordPayload): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/forgot-password", { method: "POST", body: payload })
  },

  resetPassword(token: string, payload: ResetPasswordPayload): Promise<ApiResponse<{ message: string }>> {
    return apiFetch(`/auth/reset-password/${encodeURIComponent(token)}`, { method: "PATCH", body: payload })
  },

  updatePassword(payload: UpdatePasswordPayload): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/update-password", { method: "PATCH", body: payload })
  },

  enable2fa(payload: Enable2FAPayload): Promise<ApiResponse<{ secretUrl?: string; message?: string }>> {
    return apiFetch("/auth/2fa/enable", { method: "POST", body: payload })
  },

  verify2fa(payload: Verify2FAPayload): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/2fa/verify", { method: "POST", body: payload })
  },

  disable2fa(): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/2fa/disable", { method: "DELETE" })
  },
}
