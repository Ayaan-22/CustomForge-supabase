import type { User } from "./types";
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
  pagination?: { page: number; limit: number; total: number };
};

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  params?: Record<string, string | number | boolean | undefined | null>;
  contentType?: "json" | "form";
  skipAuth?: boolean; // Skip adding Authorization header
  skipRefresh?: boolean; // Skip automatic token refresh on 401
  skipCsrfRetry?: boolean; // Internal one-retry bound for a rejected CSRF check
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// ============================================
// URL BUILDER
// ============================================

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const prefixedPath = path.startsWith("/api/")
    ? path
    : `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  // Browser API traffic must share the storefront origin so Strict session/CSRF
  // cookies survive hostname changes. Next forwards /api/v1 to the backend.
  // Ignore the legacy public API base, including values baked into older builds.
  const url =
    typeof window !== "undefined"
      ? new URL(prefixedPath, window.location.origin)
      : new URL(
          `${(process.env.API_BACKEND_URL || "http://localhost:5000")
            .replace(/\/+$/, "")
            .replace(/\/api\/v1$/, "")}${prefixedPath}`,
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

let refreshPromise: Promise<string | null> | null = null;

export function restoreSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (
      typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks
            .request("customforge-refresh", refreshAccessToken)
            .then((token) => token)
        : refreshAccessToken()
    ).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise!;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const csrfToken = await getCsrfToken();
    // Call refresh endpoint - browser automatically sends HttpOnly cookie
    const res = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
      credentials: "include", // CRITICAL: Send HttpOnly cookie
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
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
      const currentUser = data?.data?.user ?? useAuthStore.getState().user;
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

// Session cookies rotate after login, verification and refresh (including other tabs).
// Always obtain a token for the current cookie binding; never cache it indefinitely.
async function getCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch(buildUrl("/auth/csrf-token"), {
      cache: "no-store",
      method: "GET",
      signal: AbortSignal.timeout(30_000),
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await parseJsonSafe(res);
    return data?.data?.csrfToken || data?.csrfToken || null;
  } catch {
    return null;
  }
}

// ============================================
// MAIN API FETCH
// ============================================

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
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

  if (!SAFE_METHODS.has(method)) {
    const csrfToken = await getCsrfToken();
    if (csrfToken) {
      finalHeaders["X-CSRF-Token"] = csrfToken;
    }
  }

  try {
    const res = await fetch(url, {
      method,
      credentials: "include", // Always include cookies for refresh token
      headers: finalHeaders,
      body:
        method === "GET"
          ? undefined
          : isForm
            ? (body as FormData)
            : JSON.stringify(body ?? {}),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
      cache: "no-store",
    });

    const payload = await parseJsonSafe(res);

    // CSRF failures occur before business handlers; retry only that rejection once.
    if (
      res.status === 403 &&
      payload?.code === "CSRF_INVALID" &&
      !SAFE_METHODS.has(method) &&
      !options.skipCsrfRetry
    ) {
      return apiFetch<T>(path, { ...options, skipCsrfRetry: true });
    }

    // All callers settle on refresh failure. Never recursively refresh a refresh.
    if (
      res.status === 401 &&
      !skipAuth &&
      !options.skipRefresh &&
      !/2fa|two.factor/i.test(payload?.message || "") &&
      !new URL(url).pathname.endsWith("/auth/refresh")
    ) {
      const newToken = await restoreSession();
      if (newToken) return apiFetch<T>(path, { ...options, skipRefresh: true });
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
          (res.status >= 500
            ? "The service is unavailable. Please try again shortly."
            : null) ||
          (payload && (payload.message || payload.error)) ||
          `Request failed with ${res.status}`,
        status: res.status,
        details: payload,
        is2FARequired:
          res.status === 401 &&
          (res.headers.get("x-2fa-required") === "true" ||
            /2fa|two.factor/i.test(payload?.message || "")),
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

    if (responseData?.token && responseData?.user)
      useAuthStore.getState().setAuth(responseData.token, responseData.user);
    return {
      data: responseData as T,
      error: null,
      status: res.status,
      ...(typeof payload?.total === "number" ||
      typeof payload?.count === "number"
        ? {
            pagination: {
              page: payload.page ?? 1,
              limit: payload.limit ?? 20,
              total: payload.total ?? payload.count,
            },
          }
        : {}),
    };
  } catch (e: any) {
    const error: ApiError = {
      message:
        e?.name === "TimeoutError"
          ? "The request timed out. Please retry."
          : "Unable to connect to the server. Please check your connection and retry.",
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
  user?: User;
}) {
  const token = data.token || data.accessToken;

  if (token && data.user) {
    // Store access token and user in Zustand (in-memory)
    useAuthStore.getState().setAuth(token, data.user);
  } else {
    console.warn("storeAuthTokens: Missing token or user data");
  }

  // Refresh token is automatically stored in HttpOnly cookie by backend
  // No need to handle it here
}
