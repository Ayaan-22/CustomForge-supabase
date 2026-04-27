import { apiFetch, type ApiResponse } from "@/lib/apiClient";
import type { User } from "@/lib/types";

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export type LoginPayload = {
  email: string;
  password: string;
  twoFactorToken?: string;
};

export type ForgotPasswordPayload = { email: string };

export type ResetPasswordPayload = {
  password: string;
  passwordConfirm: string;
};

export type UpdatePasswordPayload = {
  passwordCurrent: string;
  password: string;
  passwordConfirm: string;
};

export type Enable2FAPayload = { password: string };
export type Verify2FAPayload = { token: string };
export type Disable2FAPayload = { password: string; token: string };

export const AuthService = {
  health(): Promise<ApiResponse<{ status: string }>> {
    return apiFetch("/health");
  },

  register(payload: RegisterPayload): Promise<ApiResponse<{ user: User }>> {
    return apiFetch("/auth/register", {
      method: "POST",
      body: payload,
      skipAuth: true,
      skipRefresh: true,
    });
  },

  login(
    payload: LoginPayload
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    return apiFetch("/auth/login", {
      method: "POST",
      body: payload,
      skipAuth: true,
      skipRefresh: true,
    });
  },

  logout(): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/logout", { method: "GET" });
  },

  verifyEmail(
    token: string
  ): Promise<ApiResponse<{ message: string; token?: string }>> {
    return apiFetch(`/auth/verify-email/${encodeURIComponent(token)}`, {
      method: "GET",
    });
  },

  sendVerificationEmail(): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/send-verification-email", { method: "POST" });
  },

  refreshToken(): Promise<ApiResponse<{ token: string; user: User }>> {
    return apiFetch("/auth/refresh", { method: "POST" });
  },

  forgotPassword(
    payload: ForgotPasswordPayload
  ): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/forgot-password", { method: "POST", body: payload });
  },

  resetPassword(
    token: string,
    payload: ResetPasswordPayload
  ): Promise<ApiResponse<{ message: string; token?: string }>> {
    return apiFetch(`/auth/reset-password/${encodeURIComponent(token)}`, {
      method: "POST",
      body: payload,
    });
  },

  updatePassword(
    payload: UpdatePasswordPayload
  ): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/update-password", {
      method: "PATCH",
      body: payload,
    });
  },

  enable2fa(
    payload: Enable2FAPayload
  ): Promise<
    ApiResponse<{ otpauthUrl?: string; secret?: string; message?: string }>
  > {
    return apiFetch("/auth/2fa/enable", { method: "POST", body: payload });
  },

  verify2fa(
    payload: Verify2FAPayload
  ): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/2fa/verify", { method: "POST", body: payload });
  },

  disable2fa(
    payload: Disable2FAPayload
  ): Promise<ApiResponse<{ message: string }>> {
    return apiFetch("/auth/2fa/disable", { method: "DELETE", body: payload });
  },
};
