# 🔌 API Reference

This document provides a comprehensive list of all API endpoints available in the CustomForge platform.

The authoritative, exhaustive exposure and ownership inventory is the [generated route security map](route-security-map.md), including middleware, deprecations, admin routes, and development exclusions.

## 🔑 Authentication

Base URL: `/api/v1/auth`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/register` | Register a new user |
| `POST` | `/login` | Login and receive JWT + Cookie |
| `POST` | `/logout` | Clear session cookies |
| `POST` | `/refresh` | Renew expired access tokens |
| `POST` | `/forgot-password` | Send password reset email |
| `POST` | `/reset-password/:token` | Reset password with token |
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
| `GET` | `/brands` | List published catalog brands |
| `GET` | `/facets` | Get bounded, category-specific specification options and exact option counts |
| `POST` | `/:id/reviews` | Submit a product review |

### Product listing filters

`GET /api/v1/products` filters published, active products before counting and pagination. It returns `{ success: true, page, limit, total, results, data }`, where `total` is the complete number of matching products and `results` is the number returned on the current page. `limit` defaults to 20 and is bounded to 1–100. Public sort fields are allowlisted; product ID is a secondary sort key to make pagination deterministic when primary values tie.

| Query parameter | Format and behavior |
| :--- | :--- |
| `category` | Exact stored category; required when selecting category-specific `specs`. |
| `brand` | Existing single-brand format, retained for backward compatibility. |
| `brands` | URL-encoded JSON array of brand strings, e.g. `["AMD","Intel"]`. Up to 20 brands; each string is nonempty and at most 160 characters. Matching uses OR. If both `brand` and `brands` are supplied, their distinct selections are combined. |
| `specs` | URL-encoded JSON object mapping canonical facet keys to arrays of option `value` strings, e.g. `{"socket":["am5"],"cores":["6","8"]}` for CPU. Use the keys and values returned by `/facets`, rather than display labels. Matching uses OR within each array and AND between fields. At most 8 fields and 12 values per field; each value is nonempty and at most 160 characters. |
| `q` | Search text, up to 200 characters. A query of at least two characters searches name, description and brand. |
| `minPrice`, `maxPrice` | Nonnegative finite price bounds applied to the catalog's final price. Maximum must not be below minimum. |
| `availability` | Exact published availability value. |
| `minRating`, `maxRating` | Inclusive rating bounds between 0 and 5. Maximum must not be below minimum. |
| `features` | Existing comma-separated exact feature values. Every requested feature must match. |
| `isFeatured`, `discounted` | `true` or `false`. `discounted=true` includes products with a positive discount; `false` leaves discounts unrestricted. |
| `page`, `limit`, `sort` | Pagination and public sort selection, e.g. `page=1&limit=12&sort=final_price`. |

The decoded `brands` JSON string is bounded to 3,000 characters and `specs` JSON to 4,000 characters, in addition to their per-selection limits.

Specification normalization handles known category-specific key aliases, case and whitespace, including spacing between numeric values and common units. For example, published `VRAM: 12GB` and `Video Memory: 12 GB` share the canonical GPU memory value `12 gb`. Display labels retain published text. Values are never inferred from product names, units are not converted, and absent/unknown/placeholder specifications cannot satisfy a selected filter. Categories without recognized published facet metadata do not receive invented specification options.

Encode JSON query values with a URL builder:

```javascript
const query = new URLSearchParams({
  category: "CPU",
  brands: JSON.stringify(["AMD", "Intel"]),
  specs: JSON.stringify({ socket: ["am5"], cores: ["6", "8"] }),
  page: "1",
  limit: "12",
  sort: "final_price",
});
// GET /api/v1/products?${query}
```

Malformed JSON, invalid numeric bounds, unsupported specification keys for the chosen category, and oversized selections return **400**. The catalog reads public storefront views with explicit safe projections and active-product filtering; private supplier, cost and internal inventory fields are excluded.

### Facet options and count scope

`GET /api/v1/products/facets` accepts the catalog filter parameters above. It ignores pagination and sorting. Its counts **retain category, search, price, availability, rating, exact features, featured status and deals filters, but ignore brand and specification selections**. This keeps alternative brands and specification values visible while narrowing the surrounding context. Consequently `scopeTotal` and individual option counts can differ from a currently selected product listing's `total`.

The response uses `{ success: true, data: { ... } }` with these fields:

| Response field | Meaning |
| :--- | :--- |
| `available` | `true` only when the complete bounded metadata scope was retrieved and exact facet counts can be confirmed. |
| `candidateLimit` | Currently `1000`. |
| `scopeTotal` | Exact number of published products in the count scope, or `null` when a count cannot be confirmed. |
| `scope` | Human-readable explanation of the count context. |
| `brands` | Array of `{ value, count }`, using real published brand names. |
| `specs` | Array of `{ key, label, options }`. Each option is `{ value, label, count }`; `value` is the canonical filter token and `label` is published display text. Counts deduplicate repeated aliases within one product. |
| `reason` | `null` when available; otherwise a narrowing message. |

This endpoint reads only bounded public `id`, `category`, `brand` and `specifications` metadata. It does not send a complete product catalog to the browser. Without a selected category, brand counts are available when within the bound, while specification groups remain empty.

**The 1,000-product bound is explicit.** If the facet scope exceeds 1,000 candidates, or complete metadata cannot be confirmed, `/facets` returns **200** with `available: false`, empty `brands`/`specs`, and a `reason`. It never presents partial option counts as exact. Narrow category, search or budget to enable the options. Database/query failures return **503**.

For a product listing with requested `specs`, the same bound is checked **after other filters, including selected brands, and before specification matching**. Matching IDs are counted and paginated on the server, then only that page is hydrated as product records. If this candidate scope exceeds 1,000, or complete metadata cannot be confirmed, the listing returns **422** with an explicit message to narrow category, search or budget. Requested specifications are never silently ignored. Listings without requested `specs` retain ordinary database filtering/counting/pagination without this facet-candidate limit. A database facet index or RPC is required to lift the bound safely for larger specification-filter scopes.

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
