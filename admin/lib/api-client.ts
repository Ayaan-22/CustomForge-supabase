/**
 * API Client for CustomForge Admin Dashboard
 * Handles all API requests to /api/v1/admin endpoints
 */

import { useAuthStore } from "./auth-store";
import { authClient } from "./auth-client"; // Declare the authClient variable

// Use runtime environment variable to point to server API
const RUNTIME_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api/v1";
const API_BASE = `${RUNTIME_API_BASE.replace(/\/$/, "")}/admin`;

// Temporarily hardcoded to false to force real API mode
// TODO: Revert to: const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

// Debug logging
console.log("[API Client] USE_MOCK_API:", USE_MOCK_API);
console.log("[API Client] API_BASE:", API_BASE);

const withAuth = async (response: Response) => {
  if (response.status === 401) {
    try {
      await authClient.refreshToken();
      // Retry the original request is handled by the caller catching this error
      // But here we just want to ensure token is refreshed
    } catch (error) {
      // If refresh fails, redirect to login
      useAuthStore.getState().clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw error;
    }
  }

  if (response.status === 403) {
    const error = await response.json();
    if (error.message?.includes("email")) {
      if (typeof window !== "undefined") {
        window.location.href = "/verify-email";
      }
    }
  }

  return response;
};

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = useAuthStore.getState().accessToken;

  const headers = {
    ...options.headers,
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    try {
      // Try to refresh token
      const refreshResult = await authClient.refreshToken();
      const newToken = refreshResult.token;

      // Retry request with new token
      const newHeaders = {
        ...options.headers,
        Authorization: `Bearer ${newToken}`,
      };

      response = await fetch(url, {
        ...options,
        headers: newHeaders,
        credentials: "include",
      });
    } catch (error) {
      // Refresh failed, let withAuth handle the redirect
    }
  }

  return withAuth(response);
};

export const apiClient = {
  // Dashboard & Analytics
  getDashboardOverview: async (period = "30d") => {
    if (USE_MOCK_API) {
      const data = await fetch("/mock/dashboardOverview.json").then((res) =>
        res.json()
      );
      return data;
    }
    const response = await fetchWithAuth(
      `${API_BASE}/analytics/overview?period=${period}`
    );
    if (!response.ok) {
      console.error(
        `[API Error] getDashboardOverview: ${response.status} ${response.statusText}`
      );
      throw new Error("Failed to fetch dashboard overview");
    }
    return response.json().then((res) => res.data);
  },

  getSalesAnalytics: async (days = 30, grouping = "daily") => {
    if (USE_MOCK_API) {
      return {
        totalOrders: 156,
        totalSales: 45231.89,
        avgOrderValue: 289.95,
        salesByPeriod: Array.from({ length: 7 }, (_, i) => ({
          period: new Date(Date.now() - i * 86400000)
            .toISOString()
            .split("T")[0],
          sales: Math.floor(Math.random() * 5000) + 1000,
          orders: Math.floor(Math.random() * 50) + 10,
        })).reverse(),
        topProducts: [],
        customerStats: {
          totalCustomers: 1200,
          newCustomers: 45,
          repeatCustomers: 800,
          avgOrderValue: 289.95,
        },
      };
    }
    const response = await fetchWithAuth(
      `${API_BASE}/analytics/sales?days=${days}&period=${grouping}`
    );
    if (!response.ok) throw new Error("Failed to fetch sales analytics");
    return response.json().then((res) => res.data);
  },

  getUserAnalytics: async (period = "30d") => {
    if (USE_MOCK_API) {
      // Mock user analytics structure
      return {
        totalUsers: 1250,
        activeUsers: 850,
        newUsers: 120,
        growth: 12.5,
        userGrowth: [
          { date: "2024-01", count: 100 },
          { date: "2024-02", count: 150 },
          { date: "2024-03", count: 200 },
        ],
      };
    }
    const response = await fetchWithAuth(
      `${API_BASE}/analytics/users?period=${period}`
    );
    if (!response.ok) throw new Error("Failed to fetch user analytics");
    return response.json().then((res) => res.data);
  },

  getOrderAnalytics: async (period = "30d") => {
    if (USE_MOCK_API) {
      // Return subset of sales analytics for now
      return fetch("/mock/salesAnalytics.json").then((res) => res.json());
    }
    const response = await fetchWithAuth(
      `${API_BASE}/analytics/orders?period=${period}`
    );
    if (!response.ok) throw new Error("Failed to fetch order analytics");
    return response.json().then((res) => res.data);
  },

  getProductStats: async () => {
    if (USE_MOCK_API) {
      return {
        totalProducts: 450,
        activeProducts: 420,
        lowStock: 15,
        outOfStock: 5,
        categories: 8,
      };
    }
    const response = await fetchWithAuth(`${API_BASE}/analytics/products`);
    if (!response.ok) throw new Error("Failed to fetch product stats");
    return response.json().then((res) => res.data);
  },

  getInventoryAnalytics: async () => {
    if (USE_MOCK_API) {
      return fetch("/mock/inventoryAnalytics.json").then((res) => res.json());
    }
    const response = await fetchWithAuth(`${API_BASE}/analytics/inventory`);
    if (!response.ok) throw new Error("Failed to fetch inventory analytics");
    return response.json().then((res) => res.data);
  },

  // User Management
  getUsers: async (query?: {
    search?: string;
    role?: string;
    isActive?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }) => {
    if (USE_MOCK_API) {
      const allUsers = await fetch("/mock/users.json").then((res) =>
        res.json()
      );
      const users = allUsers.users || allUsers;

      // Apply filters
      let filtered = users;
      if (query?.search) {
        const searchLower = query.search.toLowerCase();
        filtered = filtered.filter(
          (u: any) =>
            u.name?.toLowerCase().includes(searchLower) ||
            u.email?.toLowerCase().includes(searchLower)
        );
      }
      if (query?.role && query.role !== "all") {
        filtered = filtered.filter((u: any) => u.role === query.role);
      }
      if (query?.isActive) {
        if (query.isActive === "true")
          filtered = filtered.filter((u: any) => u.active === true);
        else if (query.isActive === "false")
          filtered = filtered.filter((u: any) => u.active === false);
      }

      // Apply sorting
      const sortBy = query?.sortBy || "created_at";
      const sortOrder = query?.sortOrder || "desc";
      filtered.sort((a: any, b: any) => {
        const aVal = a[sortBy] || "";
        const bVal = b[sortBy] || "";
        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });

      // Apply pagination
      const page = query?.page || 1;
      const limit = query?.limit || 10;
      const skip = (page - 1) * limit;
      const paginated = filtered.slice(skip, skip + limit);

      return {
        success: true,
        count: filtered.length,
        page,
        pages: Math.ceil(filtered.length / limit),
        data: paginated,
        filters: query,
      };
    }

    const params = new URLSearchParams();
    if (query?.search) params.append("search", query.search);
    if (query?.role) params.append("role", query.role);
    if (query?.isActive) params.append("isActive", query.isActive);
    if (query?.sortBy) params.append("sortBy", query.sortBy);
    if (query?.sortOrder) params.append("sortOrder", query.sortOrder);
    if (query?.page) params.append("page", String(query.page));
    if (query?.limit) params.append("limit", String(query.limit));

    const response = await fetchWithAuth(
      `${API_BASE}/users?${params.toString()}`
    );

    if (!response.ok) throw new Error("Failed to fetch users");
    return response.json();
  },

  getUserById: async (id: string) => {
    if (USE_MOCK_API) {
      const users = await fetch("/mock/users.json").then((res) => res.json());
      return users.find((u: any) => u.id === id) || users[0];
    }
    const response = await fetchWithAuth(`${API_BASE}/users/${id}`);
    if (!response.ok) throw new Error("Failed to fetch user");
    return response.json();
  },

  createUser: async (data: Record<string, any>) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { ...data, id: "new_user_" + Date.now() };
    }
    const response = await fetchWithAuth(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create user");
    return response.json();
  },

  updateUser: async (id: number, data: Record<string, any>) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { id, ...data };
    }
    const response = await fetchWithAuth(`${API_BASE}/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update user");
    return response.json();
  },

  deleteUser: async (id: number) => {
    if (USE_MOCK_API) {
      return { message: "User deleted" };
    }
    const response = await fetchWithAuth(`${API_BASE}/users/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete user");
    return response.json();
  },

  // Product Management
  getProducts: async (query?: {
    search?: string;
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    minStock?: number;
    maxStock?: number;
    availability?: string;
    isActive?: string;
    isFeatured?: string;
    createdFrom?: string;
    createdTo?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }) => {
    if (USE_MOCK_API) {
      const allProducts = await fetch("/mock/products.json").then((res) =>
        res.json()
      );
      // Mock filtering logic could be added here if needed, but for now just return all
      // or implement basic filtering similar to getUsers mock logic
      return {
        success: true,
        count: allProducts.length,
        page: 1,
        pages: 1,
        data: allProducts,
      };
    }

    const params = new URLSearchParams();
    if (query?.search) params.append("search", query.search);
    if (query?.category && query.category !== "all")
      params.append("category", query.category);
    if (query?.brand) params.append("brand", query.brand);
    if (query?.minPrice) params.append("minPrice", String(query.minPrice));
    if (query?.maxPrice) params.append("maxPrice", String(query.maxPrice));
    if (query?.minStock) params.append("minStock", String(query.minStock));
    if (query?.maxStock) params.append("maxStock", String(query.maxStock));
    if (query?.availability) params.append("availability", query.availability);
    if (query?.isActive) params.append("isActive", query.isActive);
    if (query?.isFeatured) params.append("isFeatured", query.isFeatured);
    if (query?.createdFrom) params.append("createdFrom", query.createdFrom);
    if (query?.createdTo) params.append("createdTo", query.createdTo);
    if (query?.sortBy) params.append("sortBy", query.sortBy);
    if (query?.sortOrder) params.append("sortOrder", query.sortOrder);
    if (query?.page) params.append("page", String(query.page));
    if (query?.limit) params.append("limit", String(query.limit));

    const response = await fetchWithAuth(
      `${API_BASE}/products?${params.toString()}`
    );
    if (!response.ok) throw new Error("Failed to fetch products");
    return response.json();
  },

  createProduct: async (data: Record<string, any>) => {
    if (USE_MOCK_API) {
      return { ...data, id: Date.now() };
    }

    // Check if we have file uploads
    const hasFiles = data.imageFiles && data.imageFiles.length > 0;

    if (hasFiles) {
      // Use FormData for file uploads
      const formData = new FormData();

      // Append all fields
      Object.keys(data).forEach((key) => {
        if (key === "imageFiles") {
          // Append files
          data.imageFiles.forEach((file: File) => {
            formData.append("images", file);
          });
        } else if (key === "images") {
          // Skip the base64 preview images
          return;
        } else if (typeof data[key] === "object" && data[key] !== null) {
          // Stringify objects (specifications, features, dimensions)
          formData.append(key, JSON.stringify(data[key]));
        } else if (data[key] !== undefined && data[key] !== null) {
          formData.append(key, String(data[key]));
        }
      });

      const response = await fetchWithAuth(`${API_BASE}/products`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to create product");
      return response.json();
    } else {
      // No files, use JSON
      const response = await fetchWithAuth(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create product");
      return response.json();
    }
  },

  updateProduct: async (id: number, data: Record<string, any>) => {
    if (USE_MOCK_API) {
      return { id, ...data };
    }

    // Check if we have file uploads
    const hasFiles = data.imageFiles && data.imageFiles.length > 0;

    if (hasFiles) {
      // Use FormData for file uploads
      const formData = new FormData();

      // Append all fields
      Object.keys(data).forEach((key) => {
        if (key === "imageFiles") {
          // Append files
          data.imageFiles.forEach((file: File) => {
            formData.append("images", file);
          });
        } else if (key === "images") {
          // Skip the base64 preview images
          return;
        } else if (typeof data[key] === "object" && data[key] !== null) {
          // Stringify objects (specifications, features, dimensions)
          formData.append(key, JSON.stringify(data[key]));
        } else if (data[key] !== undefined && data[key] !== null) {
          formData.append(key, String(data[key]));
        }
      });

      const response = await fetchWithAuth(`${API_BASE}/products/${id}`, {
        method: "PATCH",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to update product");
      return response.json();
    } else {
      // No files, use JSON
      const response = await fetchWithAuth(`${API_BASE}/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update product");
      return response.json();
    }
  },

  deleteProduct: async (id: number) => {
    if (USE_MOCK_API) {
      return { message: "Product deleted" };
    }
    const response = await fetchWithAuth(`${API_BASE}/products/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete product");
    return response.json();
  },

  toggleProductActive: async (id: number) => {
    if (USE_MOCK_API) {
      return { message: "Product status toggled" };
    }
    const response = await fetchWithAuth(
      `${API_BASE}/products/${id}/toggle-active`,
      {
        method: "PATCH",
      }
    );
    if (!response.ok) throw new Error("Failed to toggle product active status");
    return response.json();
  },

  toggleProductFeature: async (id: number) => {
    if (USE_MOCK_API) {
      return { message: "Product featured status toggled" };
    }
    const response = await fetchWithAuth(`${API_BASE}/products/${id}/feature`, {
      method: "PATCH",
    });
    if (!response.ok)
      throw new Error("Failed to toggle product feature status");
    return response.json();
  },

  updateProductStock: async (id: number, stock: number) => {
    if (USE_MOCK_API) {
      return { message: "Stock updated" };
    }
    const response = await fetchWithAuth(`${API_BASE}/products/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock }),
    });
    if (!response.ok) throw new Error("Failed to update product stock");
    return response.json();
  },

  getProductReviews: async (id: number) => {
    if (USE_MOCK_API) {
      return fetch("/mock/reviews.json").then((res) => res.json());
    }
    const response = await fetchWithAuth(`${API_BASE}/products/${id}/reviews`);
    if (!response.ok) throw new Error("Failed to fetch product reviews");
    return response.json();
  },

  deleteProductReview: async (productId: string, reviewId: string) => {
    if (USE_MOCK_API) {
      return { message: "Review deleted" };
    }
    // Note: The router has two routes for deleting reviews:
    // 1. DELETE /products/:id/reviews (which seems to expect a reviewId in body or query, or delete all?)
    // 2. DELETE /reviews/:id (direct delete by review ID)
    // Based on standard practices, we'll use the direct review delete endpoint
    const response = await fetchWithAuth(`${API_BASE}/reviews/${reviewId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete product review");
    return response.json();
  },

  // Order Management
  getOrders: async () => {
    if (USE_MOCK_API) {
      return fetch("/mock/orders.json").then((res) => res.json());
    }
    const response = await fetchWithAuth(`${API_BASE}/orders`);
    if (!response.ok) throw new Error("Failed to fetch orders");
    return response.json();
  },

  getOrderById: async (id: string) => {
    if (USE_MOCK_API) {
      const orders = await fetch("/mock/orders.json").then((res) => res.json());
      return orders.find((o: any) => o.id === id) || orders[0];
    }
    const response = await fetchWithAuth(`${API_BASE}/orders/${id}`);
    if (!response.ok) throw new Error("Failed to fetch order");
    return response.json();
  },

  updateOrderStatus: async (id: string, status: string) => {
    if (USE_MOCK_API) {
      return { message: "Order status updated" };
    }
    const response = await fetchWithAuth(
      `${API_BASE}/orders/${id}/update-status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );
    if (!response.ok) throw new Error("Failed to update order status");
    return response.json();
  },

  markOrderAsPaid: async (id: string) => {
    if (USE_MOCK_API) {
      return { message: "Order marked as paid" };
    }
    const response = await fetchWithAuth(`${API_BASE}/orders/${id}/mark-paid`, {
      method: "PATCH",
    });
    if (!response.ok) throw new Error("Failed to mark order as paid");
    return response.json();
  },

  deliverOrder: async (id: string) => {
    if (USE_MOCK_API) {
      return { message: "Order marked as delivered" };
    }
    const response = await fetchWithAuth(
      `${API_BASE}/orders/${id}/mark-delivered`,
      {
        method: "PATCH",
      }
    );
    if (!response.ok) throw new Error("Failed to mark order as delivered");
    return response.json();
  },

  refundOrder: async (id: string) => {
    if (USE_MOCK_API) {
      return { message: "Order refunded" };
    }
    // Supports both PATCH and POST as per router
    const response = await fetchWithAuth(`${API_BASE}/orders/${id}/refund`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to refund order");
    return response.json();
  },

  approveReturn: async (id: string) => {
    if (USE_MOCK_API) {
      return { message: "Return approved" };
    }
    const response = await fetchWithAuth(
      `${API_BASE}/orders/${id}/approve-return`,
      {
        method: "PATCH",
      }
    );
    if (!response.ok) throw new Error("Failed to approve return");
    return response.json();
  },

  processReturn: async (id: string) => {
    if (USE_MOCK_API) {
      return { message: "Return processed" };
    }
    const response = await fetchWithAuth(
      `${API_BASE}/orders/${id}/process-return`,
      {
        method: "PUT",
      }
    );
    if (!response.ok) throw new Error("Failed to process return");
    return response.json();
  },

  // Coupon Management
  getCoupons: async () => {
    if (USE_MOCK_API) {
      return fetch("/mock/coupons.json").then((res) => res.json());
    }
    const response = await fetchWithAuth(`${API_BASE}/coupons`);
    if (!response.ok) throw new Error("Failed to fetch coupons");
    return response.json();
  },

  getCoupon: async (id: string) => {
    if (USE_MOCK_API) {
      const coupons = await fetch("/mock/coupons.json").then((res) =>
        res.json()
      );
      return coupons.find((c: any) => c.id === id) || coupons[0];
    }
    const response = await fetchWithAuth(`${API_BASE}/coupons/${id}`);
    if (!response.ok) throw new Error("Failed to fetch coupon");
    return response.json();
  },

  createCoupon: async (data: Record<string, any>) => {
    if (USE_MOCK_API) {
      return { ...data, id: Date.now() };
    }
    const response = await fetchWithAuth(`${API_BASE}/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create coupon");
    return response.json();
  },

  updateCoupon: async (id: number, data: Record<string, any>) => {
    if (USE_MOCK_API) {
      return { id, ...data };
    }
    const response = await fetchWithAuth(`${API_BASE}/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update coupon");
    return response.json();
  },

  deleteCoupon: async (id: number) => {
    if (USE_MOCK_API) {
      return { message: "Coupon deleted" };
    }
    const response = await fetchWithAuth(`${API_BASE}/coupons/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete coupon");
    return response.json();
  },

  toggleCoupon: async (id: number) => {
    if (USE_MOCK_API) {
      return { message: "Coupon status toggled" };
    }
    const response = await fetchWithAuth(`${API_BASE}/coupons/${id}/toggle`, {
      method: "PATCH",
    });
    if (!response.ok) throw new Error("Failed to toggle coupon");
    return response.json();
  },

  // Review Management
  getReviews: async () => {
    if (USE_MOCK_API) {
      return fetch("/mock/reviews.json").then((res) => res.json());
    }
    const response = await fetchWithAuth(`${API_BASE}/reviews`);
    if (!response.ok) throw new Error("Failed to fetch reviews");
    return response.json();
  },

  moderateReview: async (id: string, action: "approve" | "reject") => {
    if (USE_MOCK_API) {
      return { message: `Review ${action}ed` };
    }
    const response = await fetchWithAuth(`${API_BASE}/reviews/${id}/moderate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) throw new Error("Failed to moderate review");
    return response.json();
  },

  deleteReview: async (id: string) => {
    if (USE_MOCK_API) {
      return { message: "Review deleted" };
    }
    const response = await fetchWithAuth(`${API_BASE}/reviews/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete review");
    return response.json();
  },

  // Log Management
  getLogs: async (page = 1, limit = 50) => {
    if (USE_MOCK_API) {
      return fetch("/mock/logs.json").then((res) => res.json());
    }
    const response = await fetchWithAuth(
      `${API_BASE}/logs?page=${page}&limit=${limit}`
    );
    if (!response.ok) throw new Error("Failed to fetch logs");
    return response.json();
  },

  getLogDetail: async (id: number) => {
    if (USE_MOCK_API) {
      const logs = await fetch("/mock/logs.json").then((res) => res.json());
      return logs.find((l: any) => l.id === id) || logs[0];
    }
    const response = await fetchWithAuth(`${API_BASE}/logs/${id}`);
    if (!response.ok) throw new Error("Failed to fetch log detail");
    return response.json();
  },

  getAvailableLogDates: async () => {
    if (USE_MOCK_API) {
      return ["2024-03-20", "2024-03-19", "2024-03-18"];
    }
    const response = await fetchWithAuth(`${API_BASE}/logs/dates/available`);
    if (!response.ok) throw new Error("Failed to fetch available log dates");
    return response.json();
  },

  getLogStats: async () => {
    if (USE_MOCK_API) {
      return {
        total: 1250,
        errors: 45,
        warnings: 120,
        info: 1085,
      };
    }
    const response = await fetchWithAuth(`${API_BASE}/logs/stats`);
    if (!response.ok) throw new Error("Failed to fetch log stats");
    return response.json().then((res) => res.data);
  },

  getErrorLogs: async (page = 1, limit = 50) => {
    if (USE_MOCK_API) {
      const logs = await fetch("/mock/logs.json").then((res) => res.json());
      return logs.filter((l: any) => l.level === "error");
    }
    const response = await fetchWithAuth(
      `${API_BASE}/logs/errors?page=${page}&limit=${limit}`
    );
    if (!response.ok) throw new Error("Failed to fetch error logs");
    return response.json();
  },

  getAccessLogs: async (page = 1, limit = 50) => {
    if (USE_MOCK_API) {
      const logs = await fetch("/mock/logs.json").then((res) => res.json());
      return logs.filter((l: any) => l.level === "info");
    }
    const response = await fetchWithAuth(
      `${API_BASE}/logs/access?page=${page}&limit=${limit}`
    );
    if (!response.ok) throw new Error("Failed to fetch access logs");
    return response.json();
  },
};
