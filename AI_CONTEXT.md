# CustomForge — detailed project context

Source-checked **October 6, 2026 (Asia/Karachi)**. This maintained reference describes the current repository, not a deployment certification or saved QA report. CustomForge is a personal project published on GitHub and remains in active development. See [AI_CONTEXT_short.md](AI_CONTEXT_short.md) for quick orientation.

When code and documentation differ, current routes, controllers, package scripts and canonical migrations are authoritative. Older conceptual docs and dated reports can lag implementation. Update this reference with relevant source changes.

## 1. Project and implementation status

CustomForge sells gaming hardware, peripherals, accessories, games and prebuilt PCs. It has a customer storefront, an admin workspace and a shared Express API backed by Supabase PostgreSQL.

| Area | Current behavior |
| --- | --- |
| Storefront | Catalog/search/filtering, deals, gallery/quick view, wishlist, four-product comparison, eight-slot PC builder, cart, checkout, account/security, addresses, orders and invoice printing/export. |
| Admin | Product/customer/order/coupon/review management, sales/inventory/overview analytics, activity logs and profile/security. Shared layouts, pagination and light/dark/system appearance. |
| Identity | Custom Express authentication against public.users, email verification, rotating refresh tokens and Speakeasy TOTP; not Supabase Auth sign-in. |
| Checkout | An owner-scoped PostgreSQL transaction reserves inventory and creates an unpaid order. COD and Stripe hosted Checkout are implemented choices. |
| Payments | Signed Stripe payment/refund webhook handling and COD collection. PayPal, direct intent/process compatibility flows, provider saved-card enrollment and admin refund execution are unavailable. |
| Reviews | Public approved/active reviews, owner create/read/update/delete and moderation/publication safeguards. |
| Device extras | Build/comparison intent, builder budget and newsletter interest can be saved locally. These do not provide cloud-saved builds, marketing email delivery or real-time stock subscriptions. |

Do not describe this as production-certified, fully real-time, multi-gateway complete or a finished refund/reconciliation system. Checked-in migrations do not establish that a hosted database applied them or that deployment/provider/email workflows are verified.

## 2. Packages and stack

There are three independent npm packages and **no root package.json or root npm workspace command**. Each application has its own package-lock.json; npm is the maintained workflow.

These versions are resolved by the checked-in lockfiles at the reference date, not inferred from manifest ranges/latest tags:

| Area | Resolved stack |
| --- | --- |
| client and admin | Next.js 15.5.27; React/React DOM 19.1.0; Tailwind CSS 4.1.17; TypeScript 5.9.3; TanStack Query 5.90.2; Zustand 5.0.8; Zod 3.25.76; Vitest 4.1.11. |
| Admin charts | Recharts 3.5.0; analytics uses it directly. An unused scaffold chart wrapper does not make charting unused. |
| Server | Node.js >=22; Express 4.22.3; @supabase/supabase-js 2.84.0; Stripe SDK 14.25.0; Nodemailer 10.0.14; Zod 4.4.1; Helmet 7.2.0; Vitest 4.1.11. |
| UI/integrations | Radix primitives, Lucide icons, Sonner/toast feedback, Geist fonts, Cloudinary image storage, Pug HTML templates and plain-text email conversion. |

Installed scaffold/optional packages do not prove active use. Shared storefront motion uses native CSS, observers and scheduled scroll work; do not assume Lenis, GSAP, WebGL or Framer Motion drives it. There is no active Supabase Realtime subscription or PayPal SDK payment implementation.

Sources: [client manifest](client/package.json), [admin manifest](admin/package.json), [server manifest](server/package.json) and their adjacent npm lockfiles.

## 3. Repository map

| Path | Responsibility |
| --- | --- |
| client/app/ | App Router shopping/account/auth routes, shared Forge styles and feature styles. |
| client/components/forge/ | Branded navigation, shopping, builder, gallery, invoice, account/auth and waiting components. |
| client/components/ui/ | Canonical primitives; legacy select/dropdown paths re-export them. |
| client/services/ and hooks/ | API contracts, Query reads/mutations; some legacy wrappers are conditional cleanup candidates. |
| client/lib/ | Transport, in-memory auth, guest shopping stores, types, compatibility, builder guidance and SKU media. |
| client/tests/ | Feature-grouped storefront regression suites, separate from application routes/modules; see [test guide](client/tests/README.md). |
| admin/app/ | Public auth routes and protected admin routes/components. |
| admin/components/patterns/ | Shared PageShell, SectionHeader, ActionBar, Pagination and empty/error/loading patterns. |
| admin/lib/ | Auth/transport, typed API contracts, transforms, policy/date helpers and navigation. |
| admin/tests/ | Feature-grouped admin regression suites for commerce, coupons, logs, products and transport; see [test guide](admin/tests/README.md). |
| server/app.js | Express app and middleware/router ordering; exports an app without opening a socket. |
| server/server.js | Process entry point, listening outside tests and shutdown/rejection handling. |
| server/controllers/, models/, validation/ | API behavior, explicit-client database models and request schemas. |
| server/routes/routeInventory.js | Canonical method/path, access, aliases and ownership. |
| server/models/migrations/ | Canonical schema, RLS, checkout/cancellation and analytics SQL. |
| server/scripts/ | catalog/, docs/, checks/, tests/ and legacy/; see [script guide](server/scripts/README.md). |
| server/tests/ | Feature groups, security/, helpers/ and integration/rls/; see [test guide](server/tests/README.md). |
| design-system/ | [Shared index](design-system/README.md), [storefront](design-system/FORGE.md), [admin](design-system/ADMIN.md). |
| docs/ | API/architecture indexes and older conceptual guides. |
| scratch/ | Ignored checks/, rewrites/, baselines/, harnesses/, tooling/ and preserved PostgreSQL data. |
| docs/reports/ | Existing ignored dated QA library, pending removal proposals in clean-up.md; not current certification. |

The redundant design-system master/navbar documents were consolidated and removed. One-off QA tools remain pending cleanup; organization did not authorize running/deleting them. Keep scratch fixtures out of both real applications.

## 4. Frontend pages and state

### Storefront

Public discovery: /, /products, /products/[id], /search, /deals, /compare, /pc-builder. Shopping/account pages: /cart, /checkout, /wishlist, /orders, /orders/[id], /orders/[id]/payment, /addresses, /addresses/new, /addresses/[id]/edit, /payment-methods, /payment-methods/new, /profile, /profile/edit, /profile/change-password, /profile/security.

Auth/recovery: /login, /register, /forgot-password, /reset-password/[token], /verify-email, /verify-email/[token]. Guest cart/wishlist browsing is supported; server persistence and checkout require active, verified authentication. A page's existence does not imply an operation works: the new saved-card page explicitly explains enrollment is unavailable.

The storefront experience includes a session-scoped branded boot animation, CSS hero scene/video fallback, product/page skeletons and custom error/empty/not-found states. Optional product video/spin-frame entries live in `public/media/products/<sku>/` and are registered by SKU in client/lib/product-media.ts. Reduced-motion users must retain complete usable content.

TanStack Query owns server reads/mutations; Zustand owns in-memory session state and device intent. Guest cart snapshots persist under customforge-guest-cart-v2; guest wishlist IDs have a separate store. Hooks merge guest intent into server cart/wishlist on sign-in. The server remains authoritative for prices, stock and permissions.

[forge-store.ts](client/lib/forge-store.ts) persists build/comparison snapshots under customforge-loadout-v1, with four compared products maximum. Builder slots: CPU, GPU, Motherboard, RAM, Storage, Power Supply, Cooler, Case. Compatibility results are pass/conflict/unknown, not certification. Revalidate price/stock/category fit before cart writes. Device budget excludes unselected parts, shipping and tax.

### Admin

Ten sidebar routes: /admin/dashboard, /admin/analytics/sales, /admin/analytics/inventory, /admin/products, /admin/orders, /admin/coupons, /admin/users, /admin/reviews, /admin/logs, /admin/profile. Public auth/recovery routes mirror relevant storefront flows. [admin-navigation.ts](admin/lib/admin-navigation.ts) owns route names, groups and icons.

Shared page/header/toolbar/results/pagination patterns keep controls universal. Sidebar links scroll independently; tables retain horizontal overflow without trapping vertical page scrolling. next-themes uses customforge-admin-theme, Dark default, and Light/System choices.

Detailed tokens, typography, motion and asset replacement points live in the design-system guides; avoid conflicting duplicate palettes.

## 5. Transport and request lifecycle

Both browser apps call **their own origin's /api/v1**. Next rewrites forward to server-only API_BACKEND_URL (default `http://localhost:5000`), normalizing a trailing /api/v1 suffix. Legacy NEXT_PUBLIC_API_BASE_URL/API_URL settings are not active transport authority.

[client/lib/apiClient.ts](client/lib/apiClient.ts) returns data/error/status envelopes; [admin/lib/transport.ts](admin/lib/transport.ts) throws ApiError and returns Response. Controller response shapes vary: use service/DTO/mappers rather than assuming one raw envelope.

Authenticated requests carry an in-memory Bearer token and credentials: include. Mutations fetch fresh CSRF, send X-CSRF-Token and bound CSRF-rejection retry. Refresh uses single-flight promises and navigator.locks where available; providers use same-origin BroadcastChannel session signals. Preserve exact login challenge credentials; distinguish TOTP-required responses from expired sessions.

Express ordering in [app.js](server/app.js):

1. trust proxy = 1, Helmet, credentialed CORS.
2. Stripe webhook with its limiter and express.raw(application/json), **before** JSON parsing, global CSRF, normal request context/logging and the protected payment router.
3. Compression, request context/ID/logging and public/specialized/API limiters.
4. JSON/URL-encoded parsing (10kb), cookies, xss-clean/hpp and unsafe-method CSRF.
5. /uploads and API routers; per-route Bearer, verified-email, role/TOTP and validation middleware.
6. Allowed development email router, process health, 404 and global error logging/handling.

Public auth POSTs do not need a Bearer token but **do need CSRF**. The webhook instead uses provider signature/protocol checks. Health is process health, not migration/database/provider readiness. Production proxy topology must match trust proxy and webhook sender-IP handling.

## 6. Identity, sessions and CSRF

CustomForge authenticates public.users itself. A Supabase Auth account alone is not an application account. Registration creates a user role; elevation is separate. Passwords are bcrypt hashes. Public serialization strips secrets in database and domain naming styles.

- POST /auth/register creates an unverified account and sends welcome/verification mail; no session is issued.
- GET /auth/verify-email/:token validates the hashed expiring link, marks verified and issues a session pair.
- POST /auth/login requires active verified credentials and, for TOTP-enabled accounts, a valid challenge code before session issuance.
- POST /auth/resend-verification is signed-out email/password-proven recovery and sends a new link without login; POST /auth/send-verification-email requires a Bearer session.
- Reset consumes its token and issues updated session state. Password changes invalidate old access tokens through password_changed_at checks.

[generateToken.js](server/utils/generateToken.js) uses JWT_ALGORITHM (HS256 default). Issued access pairs use JWT_SHORT_EXPIRES_IN (15m default). Refresh lifetime uses JWT_REFRESH_EXPIRES_IN, then JWT_EXPIRES_IN, then 30d. General signToken also defaults to 30d. These are distinct settings; the old seven-day access-cookie claim is incorrect.

Access tokens are JSON-returned and memory-held: **no jwt access-token cookie or browser-storage session token**. refresh_token is HttpOnly, SameSite=Strict and Secure in production. csrf_token is intentionally browser-readable, Strict and Secure in production. Anonymous bootstrap uses an HttpOnly anon_session.

Refresh validates cookie JWT, active user, stored refresh_token_hash and refresh_token_expires, then rotates the pair. The row stores one refresh binding per user, not per-device sessions. Cookie expiry separately uses JWT_REFRESH_COOKIE_EXPIRES_IN (30-day default); server/token validity still applies.

CSRF compares header/cookie to an HMAC bound to the current refresh token or anonymous session. Fetch GET /auth/csrf-token before unsafe calls and after rotation. CSRF_SECRET falls back to JWT_SECRET and a utility development fallback; configure a real secret. Mixing localhost/127.0.0.1 for direct browser/API requests breaks cookie assumptions; retain same-origin proxying rather than weakening policy.

Verification links default to 24 hours; reset links to 10 minutes. TOTP enrollment returns a manual base32 secret and otpauth URI, then /auth/2fa/verify confirms authenticated setup. It is not a second login endpoint. Sensitive routes accept their supported X-2FA-Token/body proof when enabled. Admin guards require admin role, verification and conditional TOTP; they do not require every admin to enroll TOTP.

## 7. Database identity and privileges

[config/db.js](server/config/db.js) separates capabilities:

| Client | Scope |
| --- | --- |
| getSupabaseClient(req), no bound identity | Anonymous public reads. |
| After protect/optionalAuth identity binding | Database-only HS256 JWT, authenticated role, verified UUID subject, 60s expiry; owner RLS applies even to application admins. Requires SUPABASE_JWT_SECRET. |
| getAuthClient() | Users-only select/insert/update for auth controller/JWT middleware; no general RPC/schema/storage capability. |
| getServiceClient() | Privileged admin/provider boundary. The request-context misuse proxy operates outside production; production also relies on correct source/route boundaries. |

Do not send the app access JWT directly to PostgREST, trust caller-supplied database identity or add a customer service-role fallback. SUPABASE_JWT_SECRET is separate from JWT_SECRET and must match compatible deployed shared signing configuration. An incompatible/asymmetric setup requires an integration change, not fabricated signing credentials.

Models require explicit clients. Public reads use security-invoker/barrier projections. Categories/brands derive from products, not separate tables. Private relations remain owner-scoped or inaccessible anonymously.

## 8. Schema and migrations

[server/models/migrations](server/models/migrations/) is the authority. Fresh setup order:

1. [schema.sql](server/models/migrations/schema.sql): base tables/functions.
2. [20260430_security_hardening.sql](server/models/migrations/20260430_security_hardening.sql): privilege/RLS and session schema support.
3. [20261002_public_storefront_rls.sql](server/models/migrations/20261002_public_storefront_rls.sql): safe projections/publication/private-table policy; PostgreSQL 15+ view options.
4. [20261003_atomic_checkout.sql](server/models/migrations/20261003_atomic_checkout.sql): checkout_cart and narrowed grants.
5. [20261004_admin_analytics.sql](server/models/migrations/20261004_admin_analytics.sql): aggregation RPC/indexes.
6. [20261004_cancel_unpaid_order.sql](server/models/migrations/20261004_cancel_unpaid_order.sql): atomic owner cancellation/restocking.

Inspect existing applied changes before upgrading; do not replay old hardening over later policies. add_stripe_customer_id.sql is a compatibility helper; base schema already has stripe_customer_id/payment_methods. admin/scripts/schema.sql is an alternate cleanup candidate, not setup authority.

| Tables | Responsibilities |
| --- | --- |
| users | Credentials/role, verification/recovery, password-change time, TOTP, active flag, Stripe association and refresh binding; some fields come from hardening. |
| user_addresses | Owner shipping/default addresses. |
| user_payment_methods | Legacy last-four/display metadata, not provider credentials/payment authorization. |
| products | SKU, category/brand, JSONB specs/ratings, decimal prices, stock/media/features/warranty, publication and sales count. |
| games, prebuilt_pcs | Product-linked specialized metadata. |
| user_wishlist | Owner/product saved items. |
| reviews | Owner/product rating/comment/media and purchase/moderation/publication fields. |
| coupons | Discount/value/date/activity/usage and per-user limits. |
| carts, cart_items | Owner cart/coupon and quantities. |
| orders, order_items | Shipping/payment/totals/status snapshots, idempotency, delivery/return state and priced lines. |

Public views: storefront_products, storefront_games, storefront_prebuilt_pcs, storefront_reviews, storefront_categories, storefront_brands. They expose published catalog/appropriate reviews, not customer profiles or secret joins. DTOs generally use camelCase and database rows snake_case; retain existing mappers, UUID ownership and numeric/currency conversions.

## 9. Catalog, reviews and compatibility

Catalog supports search, price/rating/stock/category/deal filters, pagination and whitelisted sorting. Brands use OR; choices within a spec use OR; distinct specs/base groups use AND. /products/facets normalizes published metadata with a 1,000-candidate bound. Larger sets require narrowing or a database facet index/RPC; do not label samples complete. Sources: [catalogFacets.js](server/utils/catalogFacets.js), product controller and client catalog components.

Public reviews use the approved/active projection. Owner retrieval is separately GET /reviews/products/:id/mine. Customer mutations cannot certify their own moderation/purchase fields; retain recalculation/publication rules.

Builder/compare consumes catalog metadata. Missing/conflicting attributes remain visible; it cannot prove every electrical, physical, firmware or manufacturer requirement. Rich product media is optional, keyed by SKU in client/lib/product-media.ts; missing video/spin frames leave the ordinary gallery. There are no active stock/order Realtime subscriptions: updates use fetch/refetch/invalidation and request flows.

## 10. Checkout and orders

POST /orders accepts shippingAddressId or shipping snapshot, paymentMethod and a stable idempotencyKey (8–255 characters). PayPal fails before inventory reservation. The controller delegates creation to checkout_cart with the owner-scoped client.

SQL validates active/verified ownership, shipping fields, 1–50 cart lines, published products, positive quantities, pricing/stock and coupon eligibility. It locks cart/items/products in stable product order, calculates totals, creates order/lines, reserves stock/increments sales, consumes coupon usage and clears cart atomically. Failures roll back. Replay returns the prior owned order without repeating inventory changes.

Current decimal USD arithmetic: discounted subtotal = items minus coupon; shipping = 0 at subtotal >=100, otherwise 10; tax = round(discounted subtotal × 0.10, 2); total = discounted subtotal + shipping + tax. These are implementation defaults, not configurable/jurisdiction-specific tax policy. Cart preview and Stripe integer cents must agree with SQL totals.

New orders are pending/unpaid and return 201; replay returns 200. Confirmation email is scheduled after commit, skipped on replay, and cannot undo the order if it fails. setImmediate is not a durable email queue.

POST /orders/cancel/:id uses cancel_unpaid_order: owner-only pending unpaid COD, transactional locks/restock/sales reversal and repeat-safe cancellation. Coupon usage remains consumed. Stripe cancellation needs provider reconciliation and is unavailable in this function.

Admin cannot arbitrarily set paid/refunded/terminal states. Eligible fulfillment uses the existing transition rules; COD collection has a dedicated mark-paid action and delivery needs shipped + paid. Customer return requests check delivery and a 30-day window. Request/approval metadata exists, but completed return/refund/inventory reconciliation is unavailable. Invoices use saved totals/state, HTML export/browser print; they are not provider receipts or tax-compliance certification.

## 11. Payments: implemented versus unavailable

| Surface | Behavior |
| --- | --- |
| POST /payment/create-stripe-session | Hosted Checkout for an owned eligible unpaid Stripe order; amount/customer/session checks, provider idempotency and version-checked binding persistence. |
| COD | Selected during POST /orders, collected through eligible admin actions; no payment/process settlement or method switch. |
| POST /payment/webhook | Signature/raw-body handling for payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled and charge.refunded; production adds sender-IP handling. |
| GET /payment/payment-methods | Existing card metadata after verifying Stripe customer ownership: id/type/brand/last4/expiry, not raw card data. |
| POST /payment/payment-methods | 503: verified provider enrollment/consent lifecycle is unavailable. Dormant detach handler also returns 503 and is not a mounted DELETE route. |
| /users/payment-methods CRUD | Separate owned legacy metadata CRUD remains mounted. CVV/CVC and non-last-four cardNumber input are rejected; card_number is redacted in responses. It does not enroll a Stripe card or authorize payment. |
| POST /payment/process, /create-intent, /create-order-cod | Protected compatibility handlers returning 503, not active payment flows. |
| POST /payment/paypal/create-order, /capture-order | Protected compatibility handlers returning 503. |
| Admin refund endpoints | 503; no money is refunded by the UI action. Full execution needs provider ledger/inventory reconciliation. |

Successful Stripe settlement checks exact minor-unit amount, USD currency, owner/order/customer metadata and PaymentIntent identity. Version-checked write failures remain retriable, not acknowledged success. Refund events preserve monotonic cumulative totals. This is not a durable provider event/reconciliation ledger. Success-page navigation alone is not settlement.

Configure the signed webhook, safe redirect origin and matching environment before validating a deployment flow. No merchant-policy or hosted certification is implied.

## 12. API ownership and canonical examples

Base: /api/v1. [routeInventory.js](server/routes/routeInventory.js) is the exact method/path/middleware/alias inventory; [route-security-map.md](docs/api/route-security-map.md) is its generated reference. Prefer these to old examples/comments.

| Group | Canonical routes/access |
| --- | --- |
| Auth bootstrap | GET /auth/csrf-token; POST /auth/register, /login, /logout, /refresh, /forgot-password, /reset-password/:token, /resend-verification; GET /auth/verify-email/:token. Unsafe methods need CSRF even without Bearer auth. |
| Account auth | POST /auth/send-verification-email; PATCH /auth/update-password; POST /auth/2fa/enable, /verify; DELETE /auth/2fa/disable. Per-operation access differs. |
| Session/profile | GET /users/me is optionalAuth (anonymous data null). /users/profile, addresses, wishlist and other protected routes need verified auth; sensitive changes add conditional TOTP. |
| Catalog | GET /products, /top, /search, /categories, /brands, /facets, /featured, /category/:category, /:id, /:id/related, /:id/reviews. Public reads do not need login. |
| Wishlist/reviews | Wishlist CRUD under /users/wishlist; review create POST /products/:id/reviews; owner read/mutations under /reviews. Aliases retain inventoried deprecation/access. |
| Cart | GET/DELETE /cart; POST /cart/add, /cart/coupon; DELETE /cart/coupon; PATCH /cart/update; DELETE /cart/remove/:id. Verified auth. |
| Orders | GET/POST /orders, GET /orders/:id, /:id/payment-status; POST /orders/cancel/:id, /request-return/:id. Prefer canonical history over legacy users orders aliases. |
| Admin | /admin analytics/users/products/orders/coupons/reviews/logs: protect, admin role, verification and conditional TOTP. Listed disabled handlers remain unavailable. |
| Health | GET /health: public process status. |
| Development email | Four POST /email/send-* helpers: gated admin/verified/TOTP, development or explicitly opted-in test mode only; not anonymous public mail APIs. |

Registration is /auth/register, not /auth/signup. Logout is POST, not GET. Refresh is cookie-based and does not require protect/access-token middleware. Anonymous /users/me differs from /users/profile. Keep static product paths ahead of /:id and update inventory with route/alias changes.

## 13. Admin analytics, logs, mail and media

admin_analytics(p_kind, p_days, p_period) aggregates overview, sales, users, orders, products and inventory in PostgreSQL. The controller allows 1–365 days and daily/weekly/monthly sales grouping. It does not use row-capped JavaScript samples. An absent/unavailable RPC returns 503 without fabricated fallback. Revenue uses qualifying paid orders excluding cancelled/fully refunded statuses, not net partial-refund accounting. Inventory is current state; other metrics have stated time scope.

Winston records request IDs, contextual responses/errors and rotated files. Log readers validate **server-local** filename dates, support plain/rotated/gzip files and honest empty days. LOG_DIR controls location; normal server-package startup uses its logs directory. Retain redaction/date/path validation; do not surface arbitrary filesystem paths or secret payloads.

Nodemailer/Pug and emailData helpers produce HTML/plain-text welcome, verification, reset, order confirmation, cancellation and return-request emails. Settings: EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD and EMAIL_FROM. Credentials are required outside optional development mode; secure SMTP/TLS is configured. Development without credentials can report a dummy logged send, which does not prove inbox delivery. Newsletter UI only saves device interest; no marketing sender/subscription persistence exists.

Cloudinary product media requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET; missing setup makes operations unavailable (503). Express serves /uploads; runtime files are ignored. Client next/image accepts configured Cloudinary, Unsplash and public Supabase storage hosts with WebP output; admin images are unoptimized.

## 14. Configuration and maintained commands

Never put real secrets, account emails/passwords, project IDs or personal machine paths in this public reference. No committed environment example/template files currently exist; use [README.md](README.md) placeholder templates.

| Settings | Role |
| --- | --- |
| NODE_ENV, PORT, CLIENT_URL, ADMIN_URL | Mode, API port, allowed/redirect origins. |
| API_BACKEND_URL | Next server-only upstream, configured separately per app as needed. |
| SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | Backend scoped clients; service credentials never enter browser code. |
| SUPABASE_JWT_SECRET | Compatible database JWT signing, distinct from JWT_SECRET. |
| JWT_SECRET, JWT_ALGORITHM, JWT_SHORT_EXPIRES_IN, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN, JWT_REFRESH_COOKIE_EXPIRES_IN | App token/cookie policy. |
| CSRF_SECRET | Request binding. |
| STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | Provider initialization/signature checks; test mode for local payment work. |
| EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_FROM; CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | Mail and images. |
| `RATE_*` and `LOG_*`; ENABLE_DEV_ROUTES | Existing limiter/logger settings and opt-in test-mode email helpers; inspect source for exact supported flags. |
| NEXT_PUBLIC_HERO_VIDEO, NEXT_PUBLIC_DEAL_ENDS_AT | Optional video and real future campaign deadline. Absent/expired deadline does not create a timer. |

Run npm --prefix so default dotenv lookup is the server package directory. app/server also attempt config/config.env, absent here. Import-time env lookup from the wrong directory is not supported setup. Database/payment modules initialize at startup, so COD-only development still needs required configuration. NODE_TLS_REJECT_UNAUTHORIZED=0 is rejected; never disable certificate verification.

Install and run from root, using separate terminals:

```powershell
npm --prefix server ci
npm --prefix client ci
npm --prefix admin ci
npm --prefix server run dev
npm --prefix client run dev -- --port 3000
npm --prefix admin run dev -- --port 3001
```

API PORT defaults to 5000. Both Next commands otherwise default to framework port 3000; admin 3001 is explicit in these examples. A currently running developer session may choose other ports.

```powershell
npm --prefix server test
npm --prefix client test
npm --prefix admin test
npm --prefix client run lint
npm --prefix admin run lint
npm --prefix client run typecheck
npm --prefix admin run typecheck
npm --prefix server run check:db-architecture
npm --prefix server run test:security
npm --prefix server run docs:routes
```

Server has no lint/typecheck/build npm script. test:security intentionally covers three files, not every security test. test:rls separately requires dedicated local PostgreSQL/psql: creates/drops a temporary database and may create cluster roles. It is not hosted certification.

Client Vitest discovers tests/**/*.{test,spec}.{ts,tsx} under client/tests/. Tests use the @/ alias for application imports/mocks, Node execution and controlled request/React-rendering fixtures. Run a feature with npm --prefix client test -- tests/auth, or a file with npm --prefix client test -- tests/transport/apiClient.test.ts. This suite does not establish live browser/provider behavior.

Admin Vitest uses the same discovery pattern under admin/tests/, with @/ application imports/mocks and controlled Node/request/API fixtures. Run a feature with npm --prefix admin test -- tests/coupons, or a file with npm --prefix admin test -- tests/transport/transport.test.ts. The test:ui script opens Vitest's runner UI, not the admin website or an end-to-end browser suite.

Seed: npm --prefix server run seed validates 40 fictional CF-DEMO- products offline. Explicit application is node server/scripts/catalog/seed-demo-catalog.js --apply --project=YOUR_PROJECT_REFERENCE; inserts are additive, not a product/user/order reset. Never use scripts/legacy/seed-supabase.js for setup.

Frontend build/start use each package. Client preview flag is FORGE_PREVIEW=1; admin uses **FORGE_ADMIN_PREVIEW=1**, optionally FORGE_ADMIN_NO_BUILD_CACHE=1 for preview webpack cache. Both select .forge-preview instead of normal .next. Preserve the corresponding flag across build/start and align authenticated/payment origins.

Development/test rate-limit skipping uses RATE_LIMIT_ENABLED and RATE_LIMIT_IN_DEV/RATE_LIMIT_IN_TEST; local defaults do not necessarily exercise enforced limits. Production-like modes cannot bypass limits through the development flag. The existing in-memory limiters are not a distributed shared store.

## 15. Public repository and change discipline

Owner preference: maintain regression/security tests; retire one-off assistant QA. Do not add permanent screenshots, contrast/export archives, dated test-total reports or machine-specific helpers. Use disposable temporary verification and communicate results; documentation describes implementation, not stale execution records.

[.gitignore](.gitignore) excludes dependencies/builds/caches/test output, actual secrets, runtime uploads/logs/backups, local tools, all scratch and all docs/reports output. Workflows and maintained code/docs stay visible. Ignore rules neither remove tracked files nor erase history.

[clean-up.md](clean-up.md) is the exact deletion checklist. Broad QA/report/cache and conditional source/asset proposals remain pending; organization was not deletion approval. Redundant master/navbar design docs were separately removed and recorded. Preserve PostgreSQL data, recovery backups, dependencies, canonical migrations and unrelated dirty-tree work. Static unused-import candidates are conditional, not blanket deletion/package-uninstall authority.

Read relevant source/local instructions before implementation. Preserve same-origin auth/CSRF, narrow database privileges, atomic/idempotent orders, provider-owned settlement and shared UI patterns. Update inventory, tests, configuration and documentation together when contracts change. Listing a legacy script here does not authorize its execution, provider contact, hosted DDL, deployment or commit.
