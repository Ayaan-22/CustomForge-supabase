import { USE_MOCK_API } from "./mock-config";
import { mockFetch } from "./mock-handler";
import { getAccessToken, useAuthStore } from "./auth-store";

export type ApiError = {
  message: string;
  status: number;
  details?: unknown;
  is2FARequired?: boolean;
};

export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
  status: number;
};

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  params?: Record<string, string | number | boolean | undefined | null>;
  contentType?: "json" | "form";
  skipAuth?: boolean; // Skip adding Authorization header
  skipRefresh?: boolean; // Skip automatic token refresh on 401
};

// ============================================
// URL BUILDER
// ============================================

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  const prefixedPath = path.startsWith("/api/")
    ? path
    : `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  const url = new URL(
    `${base}${prefixedPath}`,
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000"
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "")
        url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

// ============================================
// RESPONSE PARSER
// ============================================

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

// ============================================
// TOKEN REFRESH
// ============================================

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    // Call refresh endpoint - browser automatically sends HttpOnly cookie
    const res = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include", // CRITICAL: Send HttpOnly cookie
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      // Refresh token expired or invalid - clear auth but DON'T redirect
      // Let the calling code decide whether to redirect
      useAuthStore.getState().clearAuth();
      return null;
    }

    const data = await parseJsonSafe(res);
    const newToken =
      data?.data?.accessToken ||
      data?.data?.token ||
      data?.accessToken ||
      data?.token;

    if (newToken) {
      // Update Zustand store with new access token
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setAuth(newToken, currentUser);
      }
      return newToken;
    }

    return null;
  } catch (error) {
    console.error("Token refresh failed:", error);
    useAuthStore.getState().clearAuth();
    return null;
  }
}

// ============================================
// MAIN API FETCH
// ============================================

export async function apiFetch<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  if (USE_MOCK_API) {
    try {
      return await mockFetch<T>(path, options);
    } catch (e) {
      // Fall through to real fetch if mock handler throws
    }
  }

  const {
    method = "GET",
    body,
    headers = {},
    signal,
    params,
    contentType = "json",
    skipAuth = false,
  } = options;

  const url = buildUrl(path, params);
  const isForm =
    contentType === "form" ||
    (typeof FormData !== "undefined" && body instanceof FormData);

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...headers,
  };

  // Add Authorization header if token exists and not skipped
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    const res = await fetch(url, {
      method,
      credentials: "include", // Always include cookies for refresh token
      headers: finalHeaders,
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : isForm
          ? body
          : JSON.stringify(body ?? {}),
      signal,
    });

    const payload = await parseJsonSafe(res);

    // Handle 401 Unauthorized - attempt token refresh
    if (res.status === 401 && !skipAuth) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          onTokenRefreshed(newToken);
          // Retry the original request with new token
          return apiFetch<T>(path, options);
        }
      } else {
        // Wait for the ongoing refresh
        return new Promise((resolve) => {
          subscribeTokenRefresh(() => {
            resolve(apiFetch<T>(path, options));
          });
        });
      }
    }

    // Handle 403 Forbidden - check if it's email verification issue
    if (res.status === 403) {
      const errorMessage = payload?.message || payload?.error || "";
      if (
        errorMessage.toLowerCase().includes("email") &&
        errorMessage.toLowerCase().includes("verif")
      ) {
        // Redirect to email verification page
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.includes("/verify-email")
        ) {
          window.location.href = "/verify-email";
        }
      }
    }

    if (!res.ok && res.status !== 304) {
      const error: ApiError = {
        message:
          (payload && (payload.message || payload.error)) ||
          `Request failed with ${res.status}`,
        status: res.status,
        details: payload,
        is2FARequired:
          res.status === 401 && res.headers.get("x-2fa-required") === "true",
      };
      return { data: null, error, status: res.status };
    }

    // Unwrap backend response format: { success: true, data: {...} }
    // Backend returns data in payload.data, so we extract it
    let responseData = payload?.data !== undefined ? payload.data : payload;

    // CRITICAL FIX: If the backend returns token at the top level but user data inside data object,
    // we need to preserve the token by merging it into responseData
    if (
      payload &&
      typeof payload === "object" &&
      typeof responseData === "object" &&
      responseData !== null
    ) {
      if (payload.token && !responseData.token) {
        responseData = { ...responseData, token: payload.token };
      }
      if (payload.accessToken && !responseData.accessToken) {
        responseData = { ...responseData, accessToken: payload.accessToken };
      }
    }

    return { data: responseData as T, error: null, status: res.status };
  } catch (e: any) {
    const error: ApiError = {
      message: e?.message || "Network error",
      status: 0,
      details: e,
    };
    return { data: null, error, status: 0 };
  }
}

// ============================================
// HELPER: Store tokens from login/register
// ============================================

export function storeAuthTokens(data: {
  token?: string;
  accessToken?: string;
  user?: any;
}) {
  const token = data.token || data.accessToken;

  if (token && data.user) {
    // Store access token and user in Zustand (in-memory)
    useAuthStore.getState().setAuth(token, data.user);
    console.log("Auth tokens stored in memory");
  } else {
    console.warn("storeAuthTokens: Missing token or user data");
  }

  // Refresh token is automatically stored in HttpOnly cookie by backend
  // No need to handle it here
}
