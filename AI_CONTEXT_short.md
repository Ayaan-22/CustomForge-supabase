# AI Context — CustomForge

---

## 1. Project Overview

- **System**: E-commerce platform for gaming hardware, prebuilt PCs, and games.
- **Core Purpose**: High-performance retail system with real-time stock and custom PC builds.
- **Main Modules**: Auth (2FA), Catalog (Games/PCs), Cart/Wishlist, Orders, Stripe Payments, Admin Dashboard, Reviews.

---

## 2. Tech Stack

- **Frontend**: Next.js 15 (App Router), React 18, Tailwind v4, Zustand, TanStack Query, Radix UI.
- **Backend**: Node.js, Express.js.
- **Database**: Supabase (PostgreSQL).
- **Auth**: Custom JWT (HTTP-only cookies) + Bcrypt + Speakeasy (2FA).
- **External Services**: Stripe (Payments), Cloudinary (Images), Nodemailer (Emails).

---

## 3. System Architecture

- **High-level flow**: Client → Express API → Supabase/Postgres.
- **Key Components**: Middleware (Security, Auth, Rate-limiting), Controllers (Business Logic), Supabase Client (DB Ops).
- **Request Lifecycle**:
  1. Security/Logger Middleware.
  2. Auth Middleware (populates `req.user` via JWT cookie).
  3. Controller Logic (Validation → DB Transaction → Response).
  4. Global Error Handler (standardized fail/success).

---

## 4. Database Schema (Condensed)

**Users**: `id (PK)`, `email`, `password`, `role`, `stripe_customer_id`, `two_factor_enabled`.
**User_Addresses**: `id (PK)`, `user_id (FK)`, `address`, `is_default`.
**Products**: `id (PK)`, `name`, `category`, `final_price`, `stock`, `sku`.
**Games**: `id (PK)`, `product_id (FK)`, `genre`, `platform`.
**Prebuilt_Pcs**: `id (PK)`, `product_id (FK)`, `cpu`, `gpu`, `ram`.
**Carts**: `id (PK)`, `user_id (FK, Unique)`, `coupon_id (FK)`.
**Cart_Items**: `cart_id (FK)`, `product_id (FK)`, `quantity`.
**Orders**: `id (PK)`, `user_id (FK)`, `total_price`, `status`, `idempotency_key`.
**Order_Items**: `order_id (FK)`, `product_id (FK)`, `price_snapshot`, `quantity`.
**Coupons**: `id (PK)`, `code`, `discount_value`, `usage_limit`.

---

## 5. Schema Evolution Insights

- **Supabase Migration**: Moved from MongoDB to PostgreSQL for strict relational consistency.
- **Payment Scaling**: Added `stripe_customer_id` and `payment_methods` (JSONB) to `users` for native Stripe integration.
- **PC Customization**: Use of `JSONB` for `specifications` and `features` to support varying hardware data.

---

## 6. API Overview (Condensed)

**Auth**:

- `POST /auth/signup` → Create user + send verification.
- `POST /auth/login` → Verify creds + set JWT cookie.
- `POST /auth/2fa/verify` → Complete 2FA setup/login.

**Products**:

- `GET /products` → List filtered products (PC/Game specific).
- `GET /products/:id` → Detail + specs + reviews.

**Cart**:

- `GET /cart` → Fetch user cart + computed totals.
- `POST /cart/add` → Upsert product quantity in DB.

**Orders**:

- `POST /orders` → Convert cart to order (Atomic transaction).
- `GET /orders/:id` → Secure order detail for owner/admin.

**Payments**:

- `POST /payment/webhook` → Stripe event handler (Updates order `is_paid`).

---

## 7. Core Business Logic

- **Auth Flow**: JWT in cookies + CSRF protection; 2FA adds extra verification layer during login.
- **Order Processing**:
  - Load Cart + Coupon details.
  - Verify stock availability.
  - Create Order & OrderItems (Transactional).
  - Reduce Stock & Increment Sales (via Supabase RPC).
  - Clear Cart items.
- **Stock Control**: Stock checks happen at cart-to-order transition to prevent race conditions.

---

## 8. Security Model

- **Auth**: JWT-based with `protect` middleware.
- **Access**: Role-based (`admin` vs `user`) via `restrictTo` middleware.
- **Hardening**: Helmet (headers), XSS-clean (input), Rate-limit (auth/payment routes).

---

## 10. Constraints & Rules

- **No Guest Checkout**: Auth required for cart persistence and ordering.
- **Inventory**: No negative stock; reduction is enforced by database triggers/logic.
- **Idempotency**: `idempotency_key` on orders to prevent double-charging.
- **Free Shipping**: Defined by threshold in `orderController`.

---

## 11. Known Issues / TODO

- Implement full refund automation in Stripe controller.
- Optimize PC build configurator validation logic.
- Add real-time stock sync via Supabase Realtime.

---

## 12. Developer Notes

- **Pattern**: Middleware-first Express app; Models are thin wrappers around Supabase/Postgres.
- **Body Parsing**: Stripe webhook endpoint MUST use `express.raw()` before `express.json()`.
- **Folders**: `server/` (Backend), `client/` (Next.js), `admin/` (Scripts/Configs).
