"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserService } from "@/services/user-service";
import { useAuthStore } from "@/lib/auth-store";
import { AuthService } from "@/services/auth-service";
import type { User } from "@/lib/types";

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isLoading: boolean;
  refetchUser: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, accessToken, clearAuth } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasCheckedCookie, setHasCheckedCookie] = useState(false);

  // Attempt silent token refresh on mount
  useEffect(() => {
    const initAuth = async () => {
      // If we don't have an access token but might have a refresh cookie
      if (!accessToken) {
        try {
          // Try to refresh the token silently
          const response = await AuthService.refreshToken();
          if (response.data?.token && response.data?.user) {
            useAuthStore
              .getState()
              .setAuth(response.data.token, response.data.user);
          }
        } catch (error) {
          // No valid refresh token - silently fail, don't redirect
          // User can still browse public pages
          console.log("No valid session found");
        }
      }
      setIsInitializing(false);
      // After initialization, allow checking for cookie-based auth
      setHasCheckedCookie(true);
    };

    initAuth();
  }, [accessToken]);

  // Fetch current user - enable if we have accessToken, or after initialization (to check for cookie)
  const {
    data: userResponse,
    isLoading: isUserLoading,
    refetch,
    error: userError,
  } = useQuery({
    queryKey: ["me"],
    queryFn: () => UserService.me(),
    enabled: !isInitializing && (!!accessToken || hasCheckedCookie),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update user in store when fetched
  useEffect(() => {
    if (userResponse?.data?.user) {
      useAuthStore.getState().updateUser(userResponse.data.user);
      // If we got a user but no accessToken, the user is authenticated via cookie
      // We don't need to store a token since cookie auth is handled by the backend
    }
  }, [userResponse, accessToken]);

  const isEmailVerified = user?.isEmailVerified ?? false;

  const logout = async () => {
    try {
      // Call backend logout to clear HttpOnly cookie
      await AuthService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear Zustand store
      clearAuth();
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  // User is authenticated if we have a user (from cookie or token)
  // OR if we have an accessToken (even if user hasn't loaded yet)
  const isAuthenticated = !!user || !!accessToken;

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isEmailVerified,
    isLoading: isInitializing || isUserLoading,
    refetchUser: () => refetch(),
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
