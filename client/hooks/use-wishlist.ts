"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserService } from "@/services/user-service";
import type { WishlistItem } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";

// ============================================
// LOCAL STORAGE WISHLIST (for non-authenticated users)
// ============================================

const WISHLIST_STORAGE_KEY = "cf-wishlist";

function getLocalWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(WISHLIST_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocalWishlist(productIds: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(productIds));
}

function addToLocalWishlist(productId: string) {
  const current = getLocalWishlist();
  if (!current.includes(productId)) {
    setLocalWishlist([...current, productId]);
  }
}

function removeFromLocalWishlist(productId: string) {
  const current = getLocalWishlist();
  setLocalWishlist(current.filter((id) => id !== productId));
}

function clearLocalWishlist() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WISHLIST_STORAGE_KEY);
}

// ============================================
// MAIN WISHLIST HOOK (hybrid: localStorage + API)
// ============================================

export function useWishlist() {
  const { isAuthenticated } = useAuth();
  const [localWishlist, setLocalWishlistState] = useState<string[]>([]);

  // Sync local wishlist state on mount
  useEffect(() => {
    setLocalWishlistState(getLocalWishlist());
  }, []);

  // Fetch from API if authenticated
  const apiQuery = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const response = await UserService.wishlist();
      return response.data || [];
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  // Sync local wishlist to server on login
  useEffect(() => {
    if (isAuthenticated && localWishlist.length > 0) {
      // Sync local wishlist to server
      const syncToServer = async () => {
        for (const productId of localWishlist) {
          try {
            await UserService.addToWishlist(productId);
          } catch (error) {
            console.error("Failed to sync wishlist item:", productId);
          }
        }
        // Clear local storage after sync
        clearLocalWishlist();
        setLocalWishlistState([]);
        // Refetch server wishlist
        apiQuery.refetch();
      };
      syncToServer();
    }
  }, [isAuthenticated]); // Only run when auth status changes

  // Return API data if authenticated, otherwise local data
  if (isAuthenticated) {
    return apiQuery;
  }

  // Return local wishlist as query-like object for non-authenticated users
  return {
    data: localWishlist.map((productId) => ({
      productId,
      id: productId,
      addedAt: "",
    })) as WishlistItem[],
    isLoading: false,
    error: null,
    refetch: () => {
      setLocalWishlistState(getLocalWishlist());
      return Promise.resolve({} as any);
    },
  };
}

export function useAddToWishlist() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  return useMutation({
    mutationKey: ["wishlist", "add"],
    mutationFn: async (productId: string) => {
      if (isAuthenticated) {
        return UserService.addToWishlist(productId);
      } else {
        // Add to localStorage
        addToLocalWishlist(productId);
        return {
          data: { message: "Added to local wishlist" },
          error: null,
          status: 200,
        };
      }
    },
    onSuccess: () => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      }
    },
  });
}

export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  return useMutation({
    mutationKey: ["wishlist", "remove"],
    mutationFn: async (productId: string) => {
      if (isAuthenticated) {
        return UserService.removeFromWishlist(productId);
      } else {
        // Remove from localStorage
        removeFromLocalWishlist(productId);
        return {
          data: { message: "Removed from local wishlist" },
          error: null,
          status: 200,
        };
      }
    },
    onSuccess: () => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      }
    },
  });
}

// Helper hook to check if a product is in wishlist
export function useIsInWishlist(productId: string) {
  const { data: wishlist } = useWishlist();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    // Check localStorage
    const localWishlist = getLocalWishlist();
    return localWishlist.includes(productId);
  }

  return wishlist?.some((item) => item.productId === productId) ?? false;
}

// Toggle function for convenience
export function useToggleWishlist() {
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  return {
    toggle: (productId: string, isInWishlist: boolean) => {
      if (isInWishlist) {
        return removeFromWishlist.mutateAsync(productId);
      } else {
        return addToWishlist.mutateAsync(productId);
      }
    },
    isLoading: addToWishlist.isPending || removeFromWishlist.isPending,
  };
}
