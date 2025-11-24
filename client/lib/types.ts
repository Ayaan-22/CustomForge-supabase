export type StockStatus = "in-stock" | "out-of-stock" | "preorder"

export interface Rating {
  average: number // 0-5
  count: number
}

export interface Review {
  id: string
  user: string
  rating: number
  comment: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  brand: string
  category: string
  sku: string
  originalPrice: number
  discountPercentage?: number
  finalPrice?: number
  stock?: number
  availability: "In Stock" | "Out of Stock" | "Preorder"
  warranty?: string
  isFeatured?: boolean
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  salesCount?: number
  ratings: { average: number; totalReviews: number }
  images: string[]
  description: string
  specifications?: Array<{ key: string; value: string }>
  features?: string[]
  weight?: number
  dimensions?: { length?: number; width?: number; height?: number }
}

export type Role = "user" | "admin"

export interface Address {
  id: string
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
  isDefault?: boolean
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar?: string
  phone?: string
  address?: Address
  createdAt?: string
  updatedAt?: string
  twoFactorEnabled?: boolean
}

export interface CartItem {
  productId: string
  quantity: number
}

export interface Cart {
  id?: string
  items: CartItem[]
  subtotal?: number
  discount?: number
  total?: number
  couponCode?: string | null
  updatedAt?: string
}

export interface WishlistItem {
  id: string
  productId: string
  addedAt: string
}

export interface OrderItem {
  productId: string
  name?: string
  price?: number
  quantity: number
}

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "returned"

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  address?: Address
  status: OrderStatus
  subtotal?: number
  discount?: number
  total?: number
  paymentIntentId?: string
  createdAt?: string
  updatedAt?: string
}

export interface PaymentIntent {
  id: string
  clientSecret?: string
  amount: number
  currency: string
  status: "requires_payment_method" | "requires_confirmation" | "succeeded" | "processing" | "canceled" | "failed"
}

export interface PaymentMethod {
  id: string
  type: "card"
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  createdAt?: string
}

export type {
  User,
  Address,
  PaymentMethod,
  Product,
  Review,
  Coupon,
  CartItem,
  Cart,
  OrderItem,
  Order,
  WishlistItem,
} from "./schema"

export { ROLES, ORDER_STATUSES, PAYMENT_STATUSES, AVAILABILITY_STATUSES, RETURN_STATUSES } from "./schema"
