# CustomForge — quick project context

Source-checked **October 6, 2026 (Asia/Karachi)**. Read [AI_CONTEXT.md](AI_CONTEXT.md) for the detailed contracts, source links and limitations. This is a maintained implementation reference for a personal, public GitHub project; it is not deployment certification or a dated QA report.

## Packages and architecture

- **client/**: customer storefront, Next.js App Router.
- **admin/**: separate Next.js admin application, not merely scripts/configuration.
- **server/**: Express API and custom authentication backed by Supabase PostgreSQL.
- Three independent npm packages/lockfiles; no root package.json or npm workspace runner.
- Both UIs lock Next **15.5.27**, React **19.1.0**, Tailwind **4.1.17**, TypeScript **5.9.3**, TanStack Query **5.90.2**, Zustand **5.0.8**, Zod **3.25.76**, Vitest **4.1.11**. Admin analytics uses Recharts **3.5.0**.
- Server requires Node **>=22**; locks Express **4.22.3**, Supabase JS **2.84.0**, Stripe **14.25.0**, Nodemailer **10.0.14**, Zod **4.4.1**, Vitest **4.1.11**. Lockfiles, rather than latest tags/ranges, establish these versions.
- Browser → same-origin **/api/v1** → Next rewrite using server-only **API_BACKEND_URL** → Express → scoped Supabase client. Default upstream/API port: localhost:5000. Next dev defaults to 3000; select a different admin port explicitly.
- [server/app.js](server/app.js) exports the Express app without listening; [server/server.js](server/server.js) is the process entry point. Stripe raw-body webhook mounts before JSON parsing, global CSRF and protected payment routes.

## Implemented UI and shared design

Storefront: catalog/search/spec facets/sorting, deals, product gallery/quick view, wishlist, comparison, PC builder, cart/checkout, account/TOTP/recovery, addresses, order history/detail/payment and invoice export/print. Admin: overview, sales/inventory analytics, products, orders, coupons, users, reviews, activity logs and profile/security.

- [design-system/README.md](design-system/README.md) owns shared rules; [FORGE.md](design-system/FORGE.md) and [ADMIN.md](design-system/ADMIN.md) document each app. The old master/navbar guides were consolidated and removed.
- Storefront is dark with cyan/violet accents and Geist typography. Admin has Dark (default), Light and System via next-themes, persisted under customforge-admin-theme.
- Admin uses shared PageShell/SectionHeader/ActionBar/Pagination and loading/error/empty patterns. Both apps have themed menus, focus states and scrollbars; retain vertical page scrolling over horizontally overflowing tables.
- Motion uses CSS/observers/scheduled scroll work with reduced-motion support. Do not assume installed animation/scaffold libraries are active features.
- Query owns server data; Zustand holds the **in-memory** session. Guest cart/wishlist intent merges on login; the server owns price/stock/permissions.
- Device build/compare storage: customforge-loadout-v1, max four compared products and eight slots (CPU, GPU, Motherboard, RAM, Storage, Power Supply, Cooler, Case). Compatibility can be pass/conflict/unknown; it is not a manufacturer certification.
- Optional SKU media: [client/lib/product-media.ts](client/lib/product-media.ts). Optional hero/deal settings: NEXT_PUBLIC_HERO_VIDEO and NEXT_PUBLIC_DEAL_ENDS_AT.
- No cloud-saved builds, active Supabase Realtime subscriptions or marketing newsletter delivery. Newsletter interest is device-local. Missing media does not become a functioning 360° asset.

## Authentication and database boundaries

- Auth uses **public.users + bcrypt + Express JWT + Speakeasy**, not Supabase Auth login.
- Registration creates an unverified normal user and sends mail, without issuing a session. Login requires active/verified credentials and TOTP when enabled. Verification/reset consume expiring hashed links.
- Access token is returned in JSON and held in memory, then sent as Bearer. **No jwt access cookie or browser-persisted session token.** refresh_token is HttpOnly, Strict and Secure in production; csrf_token is readable; anon_session binds anonymous bootstrap.
- Access-pair default: 15 minutes via JWT_SHORT_EXPIRES_IN. Refresh default: 30 days, with its own JWT/cookie settings. Database refresh hash/expiry is one binding per user; refresh rotates the pair.
- Unsafe requests need fresh **X-CSRF-Token** even for public login/register/logout. CSRF HMAC binds to refresh token or anonymous session; use same-origin proxying. Transports coordinate refresh and bounded CSRF retry.
- protect/optionalAuth verifies identity before binding a UUID. [server/config/db.js](server/config/db.js) creates short database-only authenticated JWTs signed by **SUPABASE_JWT_SECRET**, separate from **JWT_SECRET**, enforcing owner RLS even for customer operations by admins.
- getAuthClient is users-only auth capability; getServiceClient belongs at privileged admin/provider boundaries. Its misuse proxy operates outside production; production still requires correct source/route boundaries. Models require explicit clients. Never fall back to service role for customer reads/writes.
- Admin routes require admin role, verified email and conditional TOTP. TOTP enrollment is not mandatory for every admin; /auth/2fa/verify confirms authenticated enrollment, not a separate login step.

## Canonical API and schema

All examples below have prefix **/api/v1**. Exact methods, access and aliases: [routeInventory.js](server/routes/routeInventory.js); generated reference: [route-security-map.md](docs/api/route-security-map.md).

| Flow | Canonical examples |
| --- | --- |
| Bootstrap/auth | GET /auth/csrf-token; POST /auth/register, /login, /logout, /refresh, /forgot-password, /reset-password/:token; GET /auth/verify-email/:token. Registration is not /signup; logout is not GET. |
| Verification | POST /auth/resend-verification uses signed-out email/password proof; /auth/send-verification-email requires Bearer auth. |
| Profile | GET /users/me uses optionalAuth and returns anonymous data null; protected /users/profile is different. |
| Discovery | GET /products, /products/:id, /products/facets and catalog/category/brand/search/related/review reads. |
| Cart | GET/DELETE /cart; POST /cart/add, /cart/coupon; PATCH /cart/update; DELETE /cart/remove/:id, /cart/coupon. |
| Orders | GET/POST /orders; GET /orders/:id, /orders/:id/payment-status; POST /orders/cancel/:id, /orders/request-return/:id. |
| Payment | POST /payment/create-stripe-session; signed POST /payment/webhook; GET /payment/payment-methods for owned existing Stripe card metadata. |
| Reviews/wishlist | /users/wishlist; create POST /products/:id/reviews; owner GET /reviews/products/:id/mine and inventoried review mutations. |

Canonical migrations live in [server/models/migrations/](server/models/migrations/). Fresh setup order: **schema.sql → 20260430_security_hardening.sql → 20261002_public_storefront_rls.sql → 20261003_atomic_checkout.sql → 20261004_admin_analytics.sql → 20261004_cancel_unpaid_order.sql**. Inspect an existing database's applied state before upgrading. add_stripe_customer_id.sql is a compatibility helper; admin/scripts/schema.sql is not setup authority.

Tables: users, user_addresses, user_payment_methods, products, games, prebuilt_pcs, user_wishlist, reviews, coupons, carts, cart_items, orders, order_items. Six storefront views expose published catalog/appropriate reviews without private profiles. Brands/categories derive from products. Database snake_case and DTO camelCase use explicit mappers.

## Commerce rules and limitations

- POST /orders delegates to owner-scoped **checkout_cart**. Required idempotencyKey is 8–255 characters. SQL validates ownership/shipping, 1–50 lines, products/quantities/pricing/stock/coupons, locks rows, creates order/lines, reserves inventory/records sales, consumes coupon usage and clears cart **atomically**.
- New order is pending/unpaid (201); replay returns its owned prior order (200) without repeated stock changes. Checkout idempotency is separate from provider settlement proof.
- USD defaults: discounted subtotal; shipping 0 at subtotal >=100 else 10; tax rounded to 10% of discounted subtotal; total adds shipping/tax. These defaults are not jurisdiction-specific tax policy.
- **cancel_unpaid_order** supports repeat-safe owner cancellation/restocking only for pending unpaid COD. Coupon usage remains consumed; Stripe cancellation needs provider reconciliation.
- Hosted Stripe Checkout and COD collection are implemented. Signed settlement validates amount/currency/owner/customer/intent; version-checked persistence failures remain retriable. Navigation to a success screen does not prove payment.
- PayPal, direct payment/process/intent compatibility flows, verified saved-card enrollment, admin refund execution and completed return reconciliation are unavailable (503 handlers where mounted).
- Existing Stripe card **read metadata is enabled**. Separate /users/payment-methods legacy CRUD stores validated last-four/display metadata and rejects CVV/non-last-four input; it does not enroll or authorize a provider card. A page/route existing does not imply a disabled operation works.
- Public reviews are approved/active; owner edits cannot certify moderation/purchase fields. Facets have a 1,000-candidate bound; incomplete candidates must not be presented as complete counts.
- Analytics uses PostgreSQL admin_analytics, with explicit period scope and missing-RPC 503. Paid gross revenue is not net partial-refund accounting. Inventory is current state. Logs use server-local filename dates and empty-day handling.
- Emails use Nodemailer/Pug; development without credentials can log dummy sends. Order mail scheduling is not a durable queue. Invoices use saved order totals, not tax/provider certification.

## Configuration and commands

No committed environment example files currently exist; [README.md](README.md) contains placeholder setup templates. Keep actual credentials/project IDs/personal paths out of public docs.

Server settings: NODE_ENV, PORT, CLIENT_URL, ADMIN_URL; **SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET**; JWT_SECRET, JWT_ALGORITHM, JWT_SHORT_EXPIRES_IN, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN, JWT_REFRESH_COOKIE_EXPIRES_IN; CSRF_SECRET; STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET; EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_FROM; CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET; supported RATE_/LOG_ settings. See detailed context/source for exact options. Next uses server-only API_BACKEND_URL. Import-time initialization needs required configuration even for COD development; never disable TLS verification.

From root, run each app in its own terminal:

```powershell
npm --prefix server ci
npm --prefix client ci
npm --prefix admin ci
npm --prefix server run dev
npm --prefix client run dev -- --port 3000
npm --prefix admin run dev -- --port 3001
```

Maintained checks: `npm --prefix <package> test`; client/admin run lint, typecheck and build; server run check:db-architecture, test:security, docs:routes. Server has **no lint/typecheck/build script**. test:security runs its three selected security files; full server tests cover more. test:rls uses dedicated local PostgreSQL/psql and creates/drops a temporary database; do not use it against a hosted project. Default rate-limit skipping in development/tests does not validate enforced production limits.

Scripts are grouped under [server/scripts/](server/scripts/README.md): catalog/, docs/, checks/, tests/, legacy/. Tests use [server/tests/](server/tests/README.md) feature groups, security/, helpers/, integration/rls/. Default seed validates 40 fictional products offline; applying requires explicit --apply and --project=YOUR_PROJECT_REFERENCE. Legacy scripts are not automatic setup.

Storefront regression tests live in feature groups under [client/tests/](client/tests/README.md), outside application routes/modules. Vitest discovers tests/**/*.{test,spec}.{ts,tsx}; imports/mocks use @/ application paths. Run a feature with npm --prefix client test -- tests/auth, or a file with npm --prefix client test -- tests/transport/apiClient.test.ts. Tests use controlled Node/request/React-rendering fixtures, not live browser/provider validation.

Admin regression tests follow the same feature/discovery/import structure under [admin/tests/](admin/tests/README.md). Run npm --prefix admin test -- tests/coupons or tests/transport/transport.test.ts. These use controlled Node/request/API fixtures; test:ui is Vitest's runner interface, not browser automation of the admin website.

Preview builds: client FORGE_PREVIEW=1; admin FORGE_ADMIN_PREVIEW=1, optionally FORGE_ADMIN_NO_BUILD_CACHE=1. Preserve the relevant flag for build/start so .forge-preview is used consistently.

## Public-repository maintenance

Keep automated regression/security tests. Do not retain new one-off assistant QA scripts/screenshots/reports. [.gitignore](.gitignore) excludes secrets/runtime/generated files, all scratch/ and all docs/reports/; it does not delete tracked files or history.

[clean-up.md](clean-up.md) is the deletion checklist. Broad QA/report/cache and conditional unused source/asset proposals remain **pending**; organizing folders is not deletion approval. Preserve PostgreSQL data, backups, migrations, dependencies and unrelated changes. Use current source as authority, update contracts/tests/docs together, and do not run legacy scripts, hosted DDL, payments or deployments merely because they are mentioned here.
