import { create } from "zustand"

interface AuthState {
  accessToken: string | null
  user: {
    id: string
    name: string
    email: string
    role: string
    isEmailVerified: boolean
    twoFactorEnabled: boolean
  } | null
  setToken: (token: string) => void
  setUser: (user: AuthState["user"]) => void
  clearAuth: () => void
  requiresTwoFactor: boolean
  setRequiresTwoFactor: (value: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  requiresTwoFactor: false,
  setToken: (token: string) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  clearAuth: () => set({ accessToken: null, user: null, requiresTwoFactor: false }),
  setRequiresTwoFactor: (value: boolean) => set({ requiresTwoFactor: value }),
}))
