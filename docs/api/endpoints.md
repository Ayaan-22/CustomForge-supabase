# 🔌 API Reference

This document provides a comprehensive list of all API endpoints available in the CustomForge platform.

## 🔑 Authentication

Base URL: `/api/v1/auth`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/signup` | Register a new user |
| `POST` | `/login` | Login and receive JWT + Cookie |
| `POST` | `/logout` | Clear session cookies |
| `POST` | `/refresh-token` | Renew expired access tokens |
| `POST` | `/forgot-password` | Send password reset email |
| `PATCH` | `/reset-password/:token` | Reset password with token |
| `PATCH` | `/update-password` | Update password (authenticated) |
| `POST` | `/2fa/enable` | Enable Two-Factor Authentication |
| `POST` | `/2fa/verify` | Verify and finalize 2FA setup |

---

## 👤 User Profile

Base URL: `/api/v1/users`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/profile` | Get current user's profile |
| `PATCH` | `/profile` | Update profile information |
| `GET` | `/wishlist` | Get user's saved items |
| `POST` | `/wishlist/:id` | Add product to wishlist |
| `DELETE` | `/wishlist/:id` | Remove product from wishlist |
| `GET` | `/addresses` | List saved shipping addresses |
| `POST` | `/addresses` | Create a new shipping address |

---

## 📦 Products

Base URL: `/api/v1/products`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | List all products (filtered/paginated) |
| `GET` | `/:id` | Get detailed product information |
| `GET` | `/featured` | Get featured hardware |
| `GET` | `/search` | Full-text search for products |
| `GET` | `/categories` | List all available categories |
| `POST` | `/:id/reviews` | Submit a product review |

---

## 🛒 Cart & Checkout

Base URL: `/api/v1/cart`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Get current cart items and totals |
| `POST` | `/add` | Add product to cart |
| `PATCH` | `/update` | Update item quantity |
| `DELETE` | `/remove/:id` | Remove item from cart |
| `POST` | `/coupon` | Apply discount coupon (Preview) |

---

## 🧾 Orders & Payments

Base URL: `/api/v1/orders`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/` | Create order (Strict validation) |
| `GET` | `/my-orders` | List user's order history |
| `GET` | `/:id` | Get specific order details |
| `POST` | `/payment/process` | Initiate payment (Stripe/PayPal) |

---

## 🛠️ Admin Dashboard

Base URL: `/api/v1/admin`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/analytics/overview` | High-level metrics |
| `GET` | `/users` | List and manage all users |
| `POST` | `/products` | Create a new product |
| `PATCH` | `/orders/:id/status` | Update fulfillment status |
| `GET` | `/logs` | System and access audit logs |

---

## 🛡️ Response Patterns

### Success (200 OK)

```json
{
  "status": "success",
  "data": { ... }
}
```

### Error (4xx/5xx)

```json
{
  "status": "error",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```
