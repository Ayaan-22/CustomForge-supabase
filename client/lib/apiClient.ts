import { USE_MOCK_API } from "./mock-config"
import { mockFetch } from "./mock-handler"

export type ApiError = {
  message: string
  status: number
  details?: unknown
}

export type ApiResponse<T> = {
  data: T | null
  error: ApiError | null
  status: number
}

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

type RequestOptions = {
  method?: HttpMethod
  body?: any
  headers?: Record<string, string>
  signal?: AbortSignal
  params?: Record<string, string | number | boolean | undefined | null>
  contentType?: "json" | "form"
}

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")
  const prefixedPath = path.startsWith("/api/") ? path : `/api/v1${path.startsWith("/") ? path : `/${path}`}`
  const url = new URL(
    `${base}${prefixedPath}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  )
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

async function parseJsonSafe(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return text || null
  }
}

export async function apiFetch<T = any>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  if (USE_MOCK_API) {
    try {
      return await mockFetch<T>(path, options)
    } catch (e) {
      // Fall through to real fetch if mock handler throws
    }
  }

  const { method = "GET", body, headers = {}, signal, params, contentType = "json" } = options

  const url = buildUrl(path, params)
  const isForm = contentType === "form" || (typeof FormData !== "undefined" && body instanceof FormData)

  const finalHeaders: HeadersInit = {
    Accept: "application/json",
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...headers,
  }

  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: finalHeaders,
      body: method === "GET" || method === "DELETE" ? undefined : isForm ? body : JSON.stringify(body ?? {}),
      signal,
    })

    const payload = await parseJsonSafe(res)

    if (!res.ok) {
      const error: ApiError = {
        message: (payload && (payload.message || payload.error)) || `Request failed with ${res.status}`,
        status: res.status,
        details: payload,
      }
      return { data: null, error, status: res.status }
    }

    return { data: payload as T, error: null, status: res.status }
  } catch (e: any) {
    const error: ApiError = {
      message: e?.message || "Network error",
      status: 0,
      details: e,
    }
    return { data: null, error, status: 0 }
  }
}
