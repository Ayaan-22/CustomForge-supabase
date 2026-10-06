# Final route exposure and ownership map

Generated from `server/routes/routeInventory.js` by `node scripts/docs/generate-route-map.js` (run from `server`). The HTTP suite checks exact inventory equality against the actual Express routers, including every admin and development operation. Edit the inventory with any route change, then regenerate this file.

## Access policy

Catalog and product-review reads, health, authentication entry points, and anonymous session bootstrap are intentional public surfaces. Refresh requires a refresh cookie; verification/reset require valid tokens in their handlers. Public does not mean unrestricted business access. Every non-webhook unsafe method also requires the existing CSRF cookie/header pair, including login and logout.

All customer operations require `protect` and `verifiedEmail`, except resending verification, which requires only `protect` so unverified accounts can use it. Ordinary customer operations need no admin role check: controllers scope records to the authenticated user. Product mutations retain their user/admin role allowlist. Admin operations require `protect → restrictTo(admin) → verifiedEmail → twoFactorAuth`. 2FA is enforced when enabled; mandatory admin enrollment is not imposed by this contract.

Email test utilities are mounted only in explicit development, or explicit test opt-in (`ENABLE_DEV_ROUTES=true`). Production, staging, prod, unset, and unknown environments never mount them, even with that flag. The router independently returns 404 outside the allowlist and requires verified admin access with conditional 2FA when enabled locally.

## Canonical ownership

Each operation has one canonical route. The reviews feature uses the product collection for list/create and the review resource for update/delete; these are complementary operations. Admin review moderation has a separate privileged namespace. User payment metadata and Stripe stored cards are distinct resources, not interchangeable aliases.

| Feature | Canonical operation / namespace |
| --- | --- |
| session | `GET /api/v1/users/me` |
| auth | `/api/v1/auth` |
| catalog | `/api/v1/products` |
| productReviewsRead | `GET /api/v1/products/:id/reviews` |
| productReviewsWrite | `POST /api/v1/products/:id/reviews` |
| reviewMutations | `/api/v1/reviews/:reviewId` |
| wishlist | `/api/v1/users/wishlist` |
| cart | `/api/v1/cart` |
| userOrdersList | `GET /api/v1/orders` |
| passwordChanges | `PATCH /api/v1/auth/update-password` |
| orders | `/api/v1/orders` |
| userPaymentMethods | `/api/v1/users/payment-methods` |
| stripePaymentMethods | `/api/v1/payment/payment-methods` |
| payments | `/api/v1/payment` |
| stripeWebhook | `POST /api/v1/payment/webhook` |
| admin | `/api/v1/admin` |

Compatibility routes remain callable, preserve their existing payload/response contracts, and return `Deprecation: true` plus a `Link` with `rel=successor-version`. No removal date is promised. New callers must use the canonical operation. Order-list and password-change adapters intentionally retain their legacy envelopes; the replacement is not necessarily a drop-in response parser.

The legacy admin `DELETE /products/:id/reviews` interprets `id` as a review ID, exactly as the old handler did. It is deprecated in favor of `DELETE /admin/reviews/:id`; it is not a product-wide deletion endpoint.

## Public / protocol-authenticated (24 operations)

| Method | Absolute path | Access middleware | Limits | Canonical replacement / notes |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/health` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/auth/csrf-token` | public; token/cookie checks in auth handlers where applicable | auth |  |
| GET | `/api/v1/auth/verify-email/:token` | public; token/cookie checks in auth handlers where applicable | auth + sensitiveAuth |  |
| POST | `/api/v1/auth/register` | public; token/cookie checks in auth handlers where applicable | auth + sensitiveAuth |  |
| POST | `/api/v1/auth/login` | public; token/cookie checks in auth handlers where applicable | auth + sensitiveAuth + login |  |
| POST | `/api/v1/auth/resend-verification` | public; token/cookie checks in auth handlers where applicable | auth + sensitiveAuth + verificationAccount | Email/password proof; CSRF; IP + account throttling; sends email only, no session issued |
| POST | `/api/v1/auth/logout` | public; token/cookie checks in auth handlers where applicable | auth |  |
| POST | `/api/v1/auth/forgot-password` | public; token/cookie checks in auth handlers where applicable | auth + sensitiveAuth |  |
| POST | `/api/v1/auth/reset-password/:token` | public; token/cookie checks in auth handlers where applicable | auth + sensitiveAuth |  |
| POST | `/api/v1/auth/refresh` | public; token/cookie checks in auth handlers where applicable | auth + sensitiveAuth |  |
| GET | `/api/v1/users/me` | optionalAuth; anonymous data=null | userAction | optionalAuth; data is null when anonymous |
| GET | `/api/v1/products` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/products/top` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/products/search` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/products/categories` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/products/brands` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/products/facets` | public; token/cookie checks in auth handlers where applicable | api | Bounded public specification metadata; exact counts exclude brand/spec selections |
| GET | `/api/v1/products/featured` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/products/category/:category` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/products/:id` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/products/:id/related` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/products/:id/reviews` | public; token/cookie checks in auth handlers where applicable | api |  |
| GET | `/api/v1/reviews/products/:id/reviews` | public; token/cookie checks in auth handlers where applicable | userAction | Deprecated → `GET /api/v1/products/:id/reviews` |
| POST | `/api/v1/payment/webhook` | Stripe signature (raw body) | webhook | Stripe signature; isolated from JSON parser, CSRF, and JWT |

## Authenticated customers (53 operations)

| Method | Absolute path | Access middleware | Limits | Canonical replacement / notes |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/send-verification-email` | protect | auth + sensitiveAuth |  |
| PATCH | `/api/v1/auth/update-password` | protect → verifiedEmail → twoFactorAuth | auth + sensitiveAuth |  |
| POST | `/api/v1/auth/2fa/enable` | protect → verifiedEmail | auth + sensitiveAuth |  |
| POST | `/api/v1/auth/2fa/verify` | protect → verifiedEmail | auth + sensitiveAuth |  |
| DELETE | `/api/v1/auth/2fa/disable` | protect → verifiedEmail → twoFactorAuth | auth + sensitiveAuth |  |
| GET | `/api/v1/users/profile` | protect → verifiedEmail | userAction |  |
| PATCH | `/api/v1/users/profile` | protect → verifiedEmail → twoFactorAuth | userAction |  |
| PATCH | `/api/v1/users/update-me` | protect → verifiedEmail → twoFactorAuth | userAction | Deprecated → `PATCH /api/v1/users/profile` |
| PATCH | `/api/v1/users/change-password` | protect → verifiedEmail → twoFactorAuth | userAction + sensitiveAuth | Deprecated → `PATCH /api/v1/auth/update-password`; Legacy response does not issue a new token pair; preserved for compatibility. |
| DELETE | `/api/v1/users/delete-account` | protect → verifiedEmail → twoFactorAuth | userAction |  |
| DELETE | `/api/v1/users/delete-me` | protect → verifiedEmail → twoFactorAuth | userAction | Deprecated → `DELETE /api/v1/users/delete-account` |
| GET | `/api/v1/users/wishlist` | protect → verifiedEmail | userAction |  |
| POST | `/api/v1/users/wishlist/:productId` | protect → verifiedEmail | userAction |  |
| DELETE | `/api/v1/users/wishlist/:productId` | protect → verifiedEmail | userAction |  |
| GET | `/api/v1/users/orders` | protect → verifiedEmail | userAction | Deprecated → `GET /api/v1/orders`; Legacy pagination and response envelope retained. |
| GET | `/api/v1/users/my-orders` | protect → verifiedEmail | userAction | Deprecated → `GET /api/v1/orders` |
| GET | `/api/v1/users/addresses` | protect → verifiedEmail | userAction |  |
| POST | `/api/v1/users/addresses` | protect → verifiedEmail | userAction |  |
| PATCH | `/api/v1/users/addresses/:id` | protect → verifiedEmail | userAction |  |
| PATCH | `/api/v1/users/addresses/:id/default` | protect → verifiedEmail | userAction |  |
| DELETE | `/api/v1/users/addresses/:id` | protect → verifiedEmail | userAction |  |
| GET | `/api/v1/users/payment-methods` | protect → verifiedEmail | userAction |  |
| POST | `/api/v1/users/payment-methods` | protect → verifiedEmail | userAction |  |
| PATCH | `/api/v1/users/payment-methods/:id` | protect → verifiedEmail | userAction |  |
| PATCH | `/api/v1/users/payment-methods/:id/default` | protect → verifiedEmail | userAction |  |
| DELETE | `/api/v1/users/payment-methods/:id` | protect → verifiedEmail | userAction |  |
| POST | `/api/v1/products/:id/reviews` | protect → verifiedEmail → restrictTo | api + userAction |  |
| POST | `/api/v1/products/:id/wishlist` | protect → verifiedEmail → restrictTo | api + userAction | Deprecated → `POST /api/v1/users/wishlist/:productId` |
| DELETE | `/api/v1/products/:id/wishlist` | protect → verifiedEmail → restrictTo | api + userAction | Deprecated → `DELETE /api/v1/users/wishlist/:productId` |
| GET | `/api/v1/reviews/products/:id/mine` | protect → verifiedEmail | userAction |  |
| PATCH | `/api/v1/reviews/:reviewId` | protect → verifiedEmail | userAction |  |
| DELETE | `/api/v1/reviews/:reviewId` | protect → verifiedEmail | userAction |  |
| GET | `/api/v1/cart` | protect → verifiedEmail | userAction |  |
| POST | `/api/v1/cart/add` | protect → verifiedEmail | userAction |  |
| DELETE | `/api/v1/cart` | protect → verifiedEmail | userAction |  |
| POST | `/api/v1/cart/coupon` | protect → verifiedEmail | userAction |  |
| DELETE | `/api/v1/cart/coupon` | protect → verifiedEmail | userAction |  |
| PATCH | `/api/v1/cart/update` | protect → verifiedEmail | userAction |  |
| DELETE | `/api/v1/cart/remove/:id` | protect → verifiedEmail | userAction |  |
| GET | `/api/v1/orders` | protect → verifiedEmail | userAction |  |
| POST | `/api/v1/orders` | protect → verifiedEmail | userAction | Stable idempotencyKey required; PayPal unavailable before inventory reservation. |
| POST | `/api/v1/orders/cancel/:id` | protect → verifiedEmail | userAction | Owner-only atomic cancellation for pending unpaid COD; requires cancel_unpaid_order migration. |
| POST | `/api/v1/orders/request-return/:id` | protect → verifiedEmail | userAction |  |
| GET | `/api/v1/orders/:id/payment-status` | protect → verifiedEmail | userAction |  |
| GET | `/api/v1/orders/:id` | protect → verifiedEmail | userAction |  |
| POST | `/api/v1/payment/process` | protect → verifiedEmail | payment | Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available. |
| POST | `/api/v1/payment/create-intent` | protect → verifiedEmail | payment | Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available. |
| POST | `/api/v1/payment/create-stripe-session` | protect → verifiedEmail | payment |  |
| POST | `/api/v1/payment/create-order-cod` | protect → verifiedEmail | payment | Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available. |
| POST | `/api/v1/payment/paypal/create-order` | protect → verifiedEmail | payment | Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available. |
| POST | `/api/v1/payment/paypal/capture-order` | protect → verifiedEmail | payment | Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available. |
| GET | `/api/v1/payment/payment-methods` | protect → verifiedEmail | payment | Stripe stored cards; distinct from /users/payment-methods |
| POST | `/api/v1/payment/payment-methods` | protect → verifiedEmail | payment | Enrollment disabled (503); requires provider-verified setup and consent. |

## Admin only (44 operations)

| Method | Absolute path | Access middleware | Limits | Canonical replacement / notes |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/admin/analytics/overview` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/analytics/sales` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/analytics/users` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/analytics/orders` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/analytics/products` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/analytics/inventory` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| POST | `/api/v1/admin/users` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/users` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/users/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/users/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| DELETE | `/api/v1/admin/users/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/products` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| POST | `/api/v1/admin/products` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/products/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| DELETE | `/api/v1/admin/products/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/products/:id/toggle-active` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/products/:id/feature` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/products/:id/stock` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/products/:id/reviews` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| DELETE | `/api/v1/admin/products/:id/reviews` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin | Deprecated → `DELETE /api/v1/admin/reviews/:id`; Legacy id means REVIEW id, not product id; never bulk-deletes product reviews. |
| GET | `/api/v1/admin/orders` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/orders/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/orders/:id/update-status` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/orders/:id/mark-paid` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/orders/:id/mark-delivered` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/orders/:id/refund` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/orders/:id/approve-return` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| POST | `/api/v1/admin/orders/:id/refund` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin | Deprecated → `PATCH /api/v1/admin/orders/:id/refund` |
| PUT | `/api/v1/admin/orders/:id/process-return` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| POST | `/api/v1/admin/coupons` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/coupons` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/coupons/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/coupons/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| DELETE | `/api/v1/admin/coupons/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/coupons/:id/toggle` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/reviews` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| PATCH | `/api/v1/admin/reviews/:id/moderate` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| DELETE | `/api/v1/admin/reviews/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin |  |
| GET | `/api/v1/admin/logs` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin + log |  |
| GET | `/api/v1/admin/logs/dates/available` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin + log |  |
| GET | `/api/v1/admin/logs/stats` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin + log |  |
| GET | `/api/v1/admin/logs/errors` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin + log |  |
| GET | `/api/v1/admin/logs/access` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin + log |  |
| GET | `/api/v1/admin/logs/:id` | protect → restrictTo:admin → verifiedEmail → twoFactorAuth | admin + log |  |

## Development only (admin) (4 operations)

| Method | Absolute path | Access middleware | Limits | Canonical replacement / notes |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/email/send-welcome` | rejectInProduction → protect → restrictTo:admin → verifiedEmail → twoFactorAuth | api + sensitiveAuth | Development only, or test with ENABLE_DEV_ROUTES=true. Never mounted in production/staging/unknown environments. |
| POST | `/api/v1/email/send-password-reset` | rejectInProduction → protect → restrictTo:admin → verifiedEmail → twoFactorAuth | api + sensitiveAuth | Development only, or test with ENABLE_DEV_ROUTES=true. Never mounted in production/staging/unknown environments. |
| POST | `/api/v1/email/send-order-confirmation` | rejectInProduction → protect → restrictTo:admin → verifiedEmail → twoFactorAuth | api + sensitiveAuth | Development only, or test with ENABLE_DEV_ROUTES=true. Never mounted in production/staging/unknown environments. |
| POST | `/api/v1/email/send-verification` | rejectInProduction → protect → restrictTo:admin → verifiedEmail → twoFactorAuth | api + sensitiveAuth | Development only, or test with ENABLE_DEV_ROUTES=true. Never mounted in production/staging/unknown environments. |

## Other mounted surfaces and ordering

- `GET /uploads/*` (and implicit HEAD) serves intentional public product assets from `server/public/uploads`, under the public limiter. Do not store private documents there.
- Express provides HEAD for GET routes and CORS preflight OPTIONS. Neither adds a mutation handler. The final `app.all('*')` returns 404; it never serves application data.
- Product `/search`, `/top`, `/categories`, `/featured`, `/category/:category`, `/:id/reviews`, and `/:id/related` precede `/:id`. Admin log static paths precede `/logs/:id`. Order action prefixes and payment-status paths remain explicit. There are no nested router mounts or wildcard routes inside feature routers.
- The webhook is a single application-level POST registered before JSON, CSRF, and payment authentication. It uses a separate limiter and the original raw bytes for Stripe signature verification. There is no duplicate webhook on the payment router or general CSRF path exemption.

## Hardening and verification

- Rate limits run before body parsing and CSRF. Production cannot disable limits with `RATE_LIMIT_ENABLED=false`; invalid numeric limit configuration falls back to safe positive defaults. Namespace exclusions use full path segments, so `/authentication` cannot bypass both limiter groups.
- Email verification, password changes, 2FA, registration, login, refresh, and reset flows share the sensitive-auth budget. Product review/wishlist writes additionally consume the customer-action budget. Limits are IP-based at application mounts, before authentication.
- Restarting 2FA enrollment cannot turn off existing 2FA; an enabled account with a missing secret fails closed. The existing frontend `{ password, token }` disable body remains supported.
- Auth/session/profile responses omit password hashes, 2FA secrets, and reset/verification/refresh-token material. Email action links use configured `CLIENT_URL` and existing frontend forms, not the request Host header or obsolete `/api/auth` paths.
- The HTTP suite checks every protected operation for anonymous rejection, every verified customer operation for unverified rejection, every admin operation for role rejection and successful admin dispatch, public routes, exact handler selection, alias headers, production/dev behavior, actual 429 responses, and real signed Stripe raw-body delivery.
- Business handlers and database identity lookup are controlled test doubles; auth/role/email/2FA/CSRF middleware, JWT verification, rate limiting, and Stripe signature verification are real. These checks validate API routing and access controls, not live Supabase RLS, mail delivery, or payment settlement.

## Deployment assumptions

`trust proxy` remains one trusted reverse-proxy hop to preserve deployment behavior. That proxy must overwrite forwarding headers, and direct backend access must be restricted. Limiters currently use per-process memory; multiple replicas require a shared limiter store or equivalent gateway limits. Configure `CLIENT_URL` in production for recovery/verification mail. These deployment properties cannot be verified from the local route suite.
