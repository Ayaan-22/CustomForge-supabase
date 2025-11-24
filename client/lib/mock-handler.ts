import {
  USE_MOCK_API,
  MOCK_LATENCY_MS,
  MOCK_SESSION_KEY,
  MOCK_CART_KEY,
  MOCK_WISHLIST_KEY,
  MOCK_ORDERS_KEY,
  MOCK_ADDRESSES_KEY,
  MOCK_PAYMENT_METHODS_KEY,
} from "./mock-config"
import type { ApiResponse, ApiError } from "./apiClient"
import type { User, Product, Order, Cart, Address, PaymentMethod, Review } from "./types"

// Artificial latency
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// LocalStorage helpers (safe for SSR)
function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(key)
  } catch {}
}

// Mock data cache
let mockProductsCache: Product[] | null = null
let mockUsersCache: any[] | null = null
let mockCategoriesCache: string[] | null = null
let mockCouponsCache: any[] | null = null

async function loadMockProducts(): Promise<Product[]> {
  if (mockProductsCache) return mockProductsCache
  try {
    const res = await fetch("/mock/products.json")
    const raw = await res.json()
    mockProductsCache = raw.map((p: any) => normalizeProduct(p))
    return mockProductsCache!
  } catch {
    return []
  }
}

async function loadMockUsers(): Promise<any[]> {
  if (mockUsersCache) return mockUsersCache
  try {
    const res = await fetch("/mock/users.json")
    mockUsersCache = await res.json()
    return mockUsersCache!
  } catch {
    return []
  }
}

async function loadMockCategories(): Promise<string[]> {
  if (mockCategoriesCache) return mockCategoriesCache
  try {
    const res = await fetch("/mock/categories.json")
    mockCategoriesCache = await res.json()
    return mockCategoriesCache!
  } catch {
    return ["GPU", "CPU", "Motherboard", "RAM", "Storage", "PSU", "Case", "Cooling"]
  }
}

async function loadMockCoupons(): Promise<any[]> {
  if (mockCouponsCache) return mockCouponsCache
  try {
    const res = await fetch("/mock/coupons.json")
    mockCouponsCache = await res.json()
    return mockCouponsCache!
  } catch {
    return [{ code: "SAVE10", discount: 10 }]
  }
}

// Normalize product to match Product type
function normalizeProduct(p: any): Product {
  const originalPrice = p.originalPrice ?? p.price ?? 0
  const discountPercentage = p.discountPercentage ?? 0
  const finalPrice = p.finalPrice ?? Math.round(originalPrice * (1 - discountPercentage / 100))
  return {
    id: p.id || p._id || String(Math.random()),
    name: p.name || "Unknown Product",
    brand: p.brand || "CustomForge",
    category: p.category || "Other",
    sku: p.sku || p.slug || p.id || "SKU-000",
    originalPrice,
    discountPercentage,
    finalPrice,
    stock: p.stock ?? 10,
    availability: p.availability ?? (p.stock > 0 ? "In Stock" : "Out of Stock"),
    warranty: p.warranty,
    isFeatured: p.featured ?? p.isFeatured ?? false,
    isActive: p.isActive ?? true,
    ratings: p.ratings ?? { average: p.rating ?? 4.5, totalReviews: p.reviewsCount ?? 0 },
    images: p.images ?? [p.image ?? "/gaming-component.jpg"],
    description: p.description || "",
    specifications: Array.isArray(p.specifications)
      ? p.specifications
      : p.specs
        ? Object.entries(p.specs).map(([key, value]) => ({ key, value: String(value) }))
        : [],
    features: p.features ?? [],
  }
}

// Get current mock user session
function getMockUser(): User | null {
  return getStorage<User | null>(MOCK_SESSION_KEY, null)
}

function setMockUser(user: User | null): void {
  if (user) {
    setStorage(MOCK_SESSION_KEY, user)
  } else {
    removeStorage(MOCK_SESSION_KEY)
  }
}

// Success/Error response helpers
function success<T>(data: T, status = 200): ApiResponse<T> {
  return { data, error: null, status }
}

function error(message: string, status = 400): ApiResponse<any> {
  const err: ApiError = { message, status }
  return { data: null, error: err, status }
}

// Mock API route handlers
export async function mockFetch<T>(path: string, options: any = {}): Promise<ApiResponse<T>> {
  if (!USE_MOCK_API) {
    throw new Error("Mock API not enabled")
  }

  await delay(MOCK_LATENCY_MS)

  const method = options.method || "GET"
  const body = options.body

  // Normalize path
  const cleanPath = path.replace(/^\/api\/v1/, "").replace(/^\//, "")
  const segments = cleanPath.split("/").filter(Boolean)

  // AUTH ROUTES
  if (segments[0] === "auth") {
    return handleAuthRoutes(segments, method, body) as ApiResponse<T>
  }

  // USERS ROUTES
  if (segments[0] === "users") {
    return handleUsersRoutes(segments, method, body) as ApiResponse<T>
  }

  // PRODUCTS ROUTES
  if (segments[0] === "products") {
    return handleProductsRoutes(segments, method, body, options.params) as ApiResponse<T>
  }

  // CART ROUTES
  if (segments[0] === "cart") {
    return handleCartRoutes(segments, method, body) as ApiResponse<T>
  }

  // ORDERS ROUTES
  if (segments[0] === "orders") {
    return handleOrdersRoutes(segments, method, body) as ApiResponse<T>
  }

  // PAYMENT ROUTES
  if (segments[0] === "payment") {
    return handlePaymentRoutes(segments, method, body) as ApiResponse<T>
  }

  // HEALTH CHECK
  if (segments[0] === "health") {
    return success({ status: "ok", mock: true }) as ApiResponse<T>
  }

  return error("Not found", 404) as ApiResponse<T>
}

// AUTH HANDLERS
async function handleAuthRoutes(segments: string[], method: string, body: any): Promise<ApiResponse<any>> {
  const action = segments[1]

  if (action === "register" && method === "POST") {
    const { name, email, password } = body || {}
    if (!email || !password) return error("Email and password required")
    const newUser: User = {
      id: `u_${Date.now()}`,
      name: name || email.split("@")[0],
      email,
      role: "user",
      createdAt: new Date().toISOString(),
    }
    setMockUser(newUser)
    return success({ user: newUser })
  }

  if (action === "login" && method === "POST") {
    const { email, password } = body || {}
    if (!email || !password) return error("Email and password required")
    // Accept any credentials in mock mode
    const users = await loadMockUsers()
    let user = users.find((u) => u.email === email)
    if (!user) {
      user = {
        id: `u_${Date.now()}`,
        name: email.split("@")[0],
        email,
        role: "user",
        verified: true,
        twoFactorEnabled: false,
      }
    }
    const fullUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
      avatar: user.avatar,
      phone: user.phone,
      twoFactorEnabled: user.twoFactorEnabled,
    }
    setMockUser(fullUser)
    return success({ user: fullUser })
  }

  if (action === "logout") {
    setMockUser(null)
    return success({ message: "Logged out successfully" })
  }

  if (action === "verify-email") {
    return success({ message: "Email verified successfully" })
  }

  if (action === "forgot-password" && method === "POST") {
    return success({ message: "Password reset email sent" })
  }

  if (action === "reset-password") {
    return success({ message: "Password reset successfully" })
  }

  if (action === "update-password" && method === "PATCH") {
    return success({ message: "Password updated successfully" })
  }

  if (action === "2fa") {
    const subAction = segments[2]
    if (subAction === "enable" && method === "POST") {
      return success({
        secretUrl: "otpauth://totp/CustomForge:demo@test.com?secret=MOCK2FASECRET",
        message: "2FA setup initiated",
      })
    }
    if (subAction === "verify" && method === "POST") {
      const user = getMockUser()
      if (user) {
        user.twoFactorEnabled = true
        setMockUser(user)
      }
      return success({ message: "2FA verified and enabled" })
    }
    if (subAction === "disable" && method === "DELETE") {
      const user = getMockUser()
      if (user) {
        user.twoFactorEnabled = false
        setMockUser(user)
      }
      return success({ message: "2FA disabled" })
    }
  }

  return error("Auth route not found", 404)
}

// USERS HANDLERS
async function handleUsersRoutes(segments: string[], method: string, body: any): Promise<ApiResponse<any>> {
  const action = segments[1]
  const user = getMockUser()

  if (action === "me" && method === "GET") {
    if (!user) return error("Not authenticated", 401)
    return success({ user })
  }

  if (action === "update-me" && method === "PATCH") {
    if (!user) return error("Not authenticated", 401)
    const updated = { ...user, ...body, updatedAt: new Date().toISOString() }
    setMockUser(updated)
    return success({ user: updated })
  }

  if (action === "delete-me" && method === "DELETE") {
    setMockUser(null)
    return success({ message: "Account deleted" })
  }

  if (action === "wishlist") {
    const wishlist = getStorage<string[]>(MOCK_WISHLIST_KEY, [])
    const products = await loadMockProducts()
    const items = wishlist.map((productId) => ({
      id: `w_${productId}`,
      productId,
      product: products.find((p) => p.id === productId),
      addedAt: new Date().toISOString(),
    }))
    return success({ items })
  }

  if (action === "orders") {
    const orders = getStorage<Order[]>(MOCK_ORDERS_KEY, [])
    return success({ items: orders })
  }

  if (action === "addresses") {
    const addresses = getStorage<Address[]>(MOCK_ADDRESSES_KEY, [])
    const id = segments[2]

    if (!id) {
      if (method === "GET") return success({ items: addresses })
      if (method === "POST") {
        const newAddr: Address = {
          id: `addr_${Date.now()}`,
          ...body,
          isDefault: addresses.length === 0,
        }
        addresses.push(newAddr)
        setStorage(MOCK_ADDRESSES_KEY, addresses)
        return success({ address: newAddr })
      }
    } else {
      const idx = addresses.findIndex((a) => a.id === id)
      if (idx === -1) return error("Address not found", 404)

      if (segments[3] === "default" && method === "PATCH") {
        addresses.forEach((a) => (a.isDefault = false))
        addresses[idx].isDefault = true
        setStorage(MOCK_ADDRESSES_KEY, addresses)
        return success({ address: addresses[idx] })
      }

      if (method === "PATCH") {
        addresses[idx] = { ...addresses[idx], ...body }
        setStorage(MOCK_ADDRESSES_KEY, addresses)
        return success({ address: addresses[idx] })
      }

      if (method === "DELETE") {
        const [removed] = addresses.splice(idx, 1)
        setStorage(MOCK_ADDRESSES_KEY, addresses)
        return success({ message: "Address deleted" })
      }
    }
  }

  if (action === "payment-methods") {
    const methods = getStorage<PaymentMethod[]>(MOCK_PAYMENT_METHODS_KEY, [])
    const id = segments[2]

    if (!id) {
      if (method === "GET") return success({ items: methods })
      if (method === "POST") {
        const newMethod: PaymentMethod = {
          id: `pm_${Date.now()}`,
          type: "card",
          brand: body.brand || "Visa",
          last4: body.last4 || "4242",
          expMonth: body.expMonth || 12,
          expYear: body.expYear || 2028,
          createdAt: new Date().toISOString(),
        }
        methods.push(newMethod)
        setStorage(MOCK_PAYMENT_METHODS_KEY, methods)
        return success({ paymentMethod: newMethod })
      }
    } else {
      const idx = methods.findIndex((m) => m.id === id)
      if (idx === -1) return error("Payment method not found", 404)

      if (segments[3] === "default" && method === "PATCH") {
        return success({ paymentMethod: methods[idx] })
      }

      if (method === "PATCH") {
        methods[idx] = { ...methods[idx], ...body }
        setStorage(MOCK_PAYMENT_METHODS_KEY, methods)
        return success({ paymentMethod: methods[idx] })
      }

      if (method === "DELETE") {
        methods.splice(idx, 1)
        setStorage(MOCK_PAYMENT_METHODS_KEY, methods)
        return success({ message: "Payment method deleted" })
      }
    }
  }

  return error("Users route not found", 404)
}

// PRODUCTS HANDLERS
async function handleProductsRoutes(
  segments: string[],
  method: string,
  body: any,
  params: any = {},
): Promise<ApiResponse<any>> {
  const products = await loadMockProducts()
  const action = segments[1]

  // GET /products
  if (!action && method === "GET") {
    let filtered = [...products]
    if (params?.category) filtered = filtered.filter((p) => p.category.toLowerCase() === params.category.toLowerCase())
    if (params?.brand) filtered = filtered.filter((p) => p.brand.toLowerCase() === params.brand.toLowerCase())
    if (params?.search) {
      const q = params.search.toLowerCase()
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    if (params?.minPrice)
      filtered = filtered.filter((p) => (p.finalPrice ?? p.originalPrice) >= Number(params.minPrice))
    if (params?.maxPrice)
      filtered = filtered.filter((p) => (p.finalPrice ?? p.originalPrice) <= Number(params.maxPrice))
    if (params?.rating) filtered = filtered.filter((p) => p.ratings.average >= Number(params.rating))
    if (params?.sort) {
      const sort = params.sort
      if (sort === "price_asc")
        filtered.sort((a, b) => (a.finalPrice ?? a.originalPrice) - (b.finalPrice ?? b.originalPrice))
      else if (sort === "price_desc")
        filtered.sort((a, b) => (b.finalPrice ?? b.originalPrice) - (a.finalPrice ?? a.originalPrice))
      else if (sort === "rating") filtered.sort((a, b) => b.ratings.average - a.ratings.average)
      else if (sort === "newest") filtered.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    }
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    const start = (page - 1) * limit
    const paged = filtered.slice(start, start + limit)
    return success({ items: paged, total: filtered.length })
  }

  // GET /products/featured
  if (action === "featured") {
    const featured = products.filter((p) => p.isFeatured).slice(0, 8)
    return success({ items: featured })
  }

  // GET /products/top
  if (action === "top") {
    const top = [...products].sort((a, b) => b.ratings.average - a.ratings.average).slice(0, 8)
    return success({ items: top })
  }

  // GET /products/categories
  if (action === "categories") {
    const categories = await loadMockCategories()
    return success({ items: categories })
  }

  // GET /products/search
  if (action === "search") {
    const q = (params?.q || "").toLowerCase()
    const results = products.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    return success({ items: results })
  }

  // GET /products/category/:category
  if (action === "category") {
    const cat = segments[2]
    const filtered = products.filter((p) => p.category.toLowerCase() === cat?.toLowerCase())
    return success({ items: filtered })
  }

  // GET /products/wishlist
  if (action === "wishlist") {
    const wishlist = getStorage<string[]>(MOCK_WISHLIST_KEY, [])
    const items = products.filter((p) => wishlist.includes(p.id))
    return success({ items })
  }

  // GET/POST/DELETE /products/:id/...
  const productId = action
  const product = products.find((p) => p.id === productId)
  const subAction = segments[2]

  if (!subAction && method === "GET") {
    if (!product) return error("Product not found", 404)
    return success({ item: product })
  }

  if (subAction === "related") {
    if (!product) return error("Product not found", 404)
    const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)
    return success({ items: related })
  }

  if (subAction === "reviews") {
    if (method === "GET") {
      const mockReviews: Review[] = [
        {
          id: "r1",
          user: "GamerPro",
          rating: 5,
          comment: "Excellent performance!",
          createdAt: new Date().toISOString(),
        },
        {
          id: "r2",
          user: "TechEnthusiast",
          rating: 4,
          comment: "Great value for money",
          createdAt: new Date().toISOString(),
        },
      ]
      return success({ items: mockReviews })
    }
    if (method === "POST") {
      const newReview: Review = {
        id: `r_${Date.now()}`,
        user: getMockUser()?.name || "Anonymous",
        rating: body.rating || 5,
        comment: body.comment || "",
        createdAt: new Date().toISOString(),
      }
      return success({ review: newReview })
    }
  }

  if (subAction === "wishlist") {
    const wishlist = getStorage<string[]>(MOCK_WISHLIST_KEY, [])
    if (method === "POST") {
      if (!wishlist.includes(productId)) {
        wishlist.push(productId)
        setStorage(MOCK_WISHLIST_KEY, wishlist)
      }
      return success({ message: "Added to wishlist" })
    }
    if (method === "DELETE") {
      const idx = wishlist.indexOf(productId)
      if (idx > -1) {
        wishlist.splice(idx, 1)
        setStorage(MOCK_WISHLIST_KEY, wishlist)
      }
      return success({ message: "Removed from wishlist" })
    }
  }

  return error("Products route not found", 404)
}

// CART HANDLERS
async function handleCartRoutes(segments: string[], method: string, body: any): Promise<ApiResponse<any>> {
  const products = await loadMockProducts()
  let cart = getStorage<Cart>(MOCK_CART_KEY, { items: [] })
  const action = segments[1]

  const calculateTotals = (c: Cart): Cart => {
    let subtotal = 0
    for (const item of c.items) {
      const product = products.find((p) => p.id === item.productId)
      if (product) {
        subtotal += (product.finalPrice ?? product.originalPrice) * item.quantity
      }
    }
    const discount = c.couponCode ? Math.round(subtotal * 0.1) : 0
    return { ...c, subtotal, discount, total: subtotal - discount }
  }

  // GET /cart
  if (!action && method === "GET") {
    return success({ cart: calculateTotals(cart) })
  }

  // POST /cart (set cart)
  if (!action && method === "POST") {
    cart = { ...cart, items: body.items || [] }
    setStorage(MOCK_CART_KEY, cart)
    return success({ cart: calculateTotals(cart) })
  }

  // DELETE /cart (clear)
  if (!action && method === "DELETE") {
    cart = { items: [], couponCode: null }
    setStorage(MOCK_CART_KEY, cart)
    return success({ message: "Cart cleared" })
  }

  // POST /cart/coupon
  if (action === "coupon" && method === "POST") {
    const coupons = await loadMockCoupons()
    const coupon = coupons.find((c) => c.code === body.code)
    if (!coupon) return error("Invalid coupon code")
    cart.couponCode = body.code
    setStorage(MOCK_CART_KEY, cart)
    return success({ cart: calculateTotals(cart) })
  }

  // DELETE /cart/coupon
  if (action === "coupon" && method === "DELETE") {
    cart.couponCode = null
    setStorage(MOCK_CART_KEY, cart)
    return success({ cart: calculateTotals(cart) })
  }

  // PATCH /cart/:productId (update quantity)
  if (action && method === "PATCH") {
    const idx = cart.items.findIndex((i) => i.productId === action)
    if (idx > -1) {
      cart.items[idx].quantity = body.quantity || 1
      setStorage(MOCK_CART_KEY, cart)
    }
    return success({ cart: calculateTotals(cart) })
  }

  // DELETE /cart/:productId (remove item)
  if (action && method === "DELETE") {
    cart.items = cart.items.filter((i) => i.productId !== action)
    setStorage(MOCK_CART_KEY, cart)
    return success({ cart: calculateTotals(cart) })
  }

  return error("Cart route not found", 404)
}

// ORDERS HANDLERS
async function handleOrdersRoutes(segments: string[], method: string, body: any): Promise<ApiResponse<any>> {
  const products = await loadMockProducts()
  const orders = getStorage<Order[]>(MOCK_ORDERS_KEY, [])
  const orderId = segments[1]
  const subAction = segments[2]

  // GET /orders
  if (!orderId && method === "GET") {
    return success({ items: orders })
  }

  // POST /orders (create)
  if (!orderId && method === "POST") {
    const user = getMockUser()
    let total = 0
    const items = (body.items || []).map((item: any) => {
      const product = products.find((p) => p.id === item.productId)
      const price = product?.finalPrice ?? product?.originalPrice ?? 0
      total += price * item.quantity
      return { productId: item.productId, name: product?.name, price, quantity: item.quantity }
    })
    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      userId: user?.id || "guest",
      items,
      status: "pending",
      subtotal: total,
      discount: 0,
      total,
      createdAt: new Date().toISOString(),
    }
    orders.push(newOrder)
    setStorage(MOCK_ORDERS_KEY, orders)
    // Clear cart after order
    setStorage(MOCK_CART_KEY, { items: [], couponCode: null })
    return success({ order: newOrder })
  }

  // GET /orders/:id
  if (orderId && !subAction && method === "GET") {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return error("Order not found", 404)
    return success({ order })
  }

  // GET /orders/:id/payment-status
  if (subAction === "payment-status") {
    const order = orders.find((o) => o.id === orderId)
    return success({ status: order?.status === "paid" ? "paid" : "pending" })
  }

  // PUT /orders/:id/cancel
  if (subAction === "cancel" && method === "PUT") {
    const idx = orders.findIndex((o) => o.id === orderId)
    if (idx === -1) return error("Order not found", 404)
    orders[idx].status = "cancelled"
    setStorage(MOCK_ORDERS_KEY, orders)
    return success({ order: orders[idx] })
  }

  // POST /orders/:id/return
  if (subAction === "return" && method === "POST") {
    const idx = orders.findIndex((o) => o.id === orderId)
    if (idx === -1) return error("Order not found", 404)
    orders[idx].status = "returned"
    setStorage(MOCK_ORDERS_KEY, orders)
    return success({ order: orders[idx] })
  }

  return error("Orders route not found", 404)
}

// PAYMENT HANDLERS
async function handlePaymentRoutes(segments: string[], method: string, body: any): Promise<ApiResponse<any>> {
  const action = segments[1]

  if (action === "webhook" && method === "POST") {
    return success({ received: true })
  }

  if (action === "process" && method === "POST") {
    // Update order status to paid
    const orders = getStorage<Order[]>(MOCK_ORDERS_KEY, [])
    const idx = orders.findIndex((o) => o.id === body.orderId)
    if (idx > -1) {
      orders[idx].status = "paid"
      setStorage(MOCK_ORDERS_KEY, orders)
    }
    return success({ status: "succeeded" })
  }

  if (action === "create-intent" && method === "POST") {
    return success({
      intent: {
        id: `pi_${Date.now()}`,
        clientSecret: `pi_${Date.now()}_secret_mock`,
        amount: body.amount || 0,
        currency: body.currency || "usd",
        status: "requires_payment_method",
      },
    })
  }

  if (action === "payment-methods") {
    const methods = getStorage<PaymentMethod[]>(MOCK_PAYMENT_METHODS_KEY, [])
    if (method === "GET") return success({ items: methods })
    if (method === "POST") {
      const newMethod: PaymentMethod = {
        id: `pm_${Date.now()}`,
        type: "card",
        brand: "Visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2028,
        createdAt: new Date().toISOString(),
      }
      methods.push(newMethod)
      setStorage(MOCK_PAYMENT_METHODS_KEY, methods)
      return success({ method: newMethod })
    }
  }

  return error("Payment route not found", 404)
}

// Check if mock mode is active
export function isMockMode(): boolean {
  return USE_MOCK_API
}

// Get mock auth state
export function getMockAuthState(): User | null {
  return getMockUser()
}
