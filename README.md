# CustomForge

CustomForge is a hardware and gaming commerce application with a customer storefront, an admin dashboard, and an Express API backed by Supabase PostgreSQL.

CustomForge is a personal project in active development. The repository contains three independent npm packages; run commands for the package you intend to use. This guide documents setup and maintained commands as of **2026-10-06**.

The implemented payment and account flows still need validation against your deployment configuration before public use. Run the maintained tests and check migrations, hosted permissions, email delivery and signed payment webhooks. Current unsupported features are described below; no historical QA score or report is treated as a deployment guarantee.

## Contents

- [Applications and features](#applications-and-features)
- [Repository structure](#repository-structure)
- [Requirements](#requirements)
- [Install dependencies](#install-dependencies)
- [Environment configuration](#environment-configuration)
- [Database setup and migrations](#database-setup-and-migrations)
- [Run locally](#run-locally)
- [Customer and admin accounts](#customer-and-admin-accounts)
- [Stripe configuration and checkout](#stripe-configuration-and-checkout)
- [Tests and code checks](#tests-and-code-checks)
- [Catalog and server tools](#catalog-and-server-tools)
- [Production builds and deployment](#production-builds-and-deployment)
- [Local production preview](#local-production-preview)
- [Command reference](#command-reference)
- [Troubleshooting](#troubleshooting)
- [Repository hygiene](#repository-hygiene)
- [Documentation](#documentation)

## Applications and features

| Application | Directory | Technology | Default address |
| --- | --- | --- | --- |
| Customer storefront | `client/` | Next.js 15, React 19, TypeScript, Tailwind CSS 4, TanStack Query | `http://localhost:3000` |
| Admin dashboard | `admin/` | Next.js 15, React 19, TypeScript, Radix UI, TanStack Query | `http://localhost:3001` |
| API | `server/` | Node.js 22+, Express 4, Supabase, Zod, Winston | `http://localhost:5000/api/v1` |

The storefront includes product browsing, search and filtering, comparison, PC builder guidance, wishlist, cart, addresses, checkout, order history, and account security. The admin application includes product, user, order, coupon, and review management, logs, and sales/inventory analytics.

Authentication is implemented by Express against `public.users`, using application JWTs, rotating refresh tokens, email verification, and TOTP two-factor authentication. Accounts created through Supabase Auth are not automatically CustomForge accounts. Browser access tokens stay in memory; refresh tokens use HttpOnly cookies. Mutating API requests use CSRF protection.

Checkout uses PostgreSQL RPCs to calculate authoritative totals, lock inventory, and create orders atomically. Implemented payment paths are cash on delivery (COD) and Stripe hosted Checkout. PayPal, saved-card enrollment/change, and the admin refund operation currently return unavailable responses. Customer cancellation is limited to eligible **pending, unpaid COD** orders. Card-order cancellation and a complete returns/refund workflow remain outstanding. PayPal, saved-card setup and admin refunds are unavailable; do not expose them as completed features.

The current Stripe controller uses USD. Checkout SQL charges shipping of 10 below a discounted subtotal of 100, otherwise zero, and tax of 10% on that subtotal. These are implementation defaults, not configurable environment settings; changes must keep the cart preview, checkout RPC, and payment totals consistent.

## Repository structure

```text
CustomForge-supabase/
├── client/                     Customer Next.js application
│   ├── app/                    Routes, layouts, and pages
│   ├── components/             Shared and feature UI
│   ├── hooks/                  State and API hooks
│   ├── lib/                    Transport, validation, and utilities
│   ├── services/               API-facing application services
│   ├── tests/                  Feature-grouped storefront regression tests
│   └── public/                 Static storefront assets
├── admin/                      Admin Next.js application
│   ├── app/                    Login and admin routes/components
│   ├── components/             Shared UI
│   ├── lib/                    Auth transport and data transformations
│   ├── tests/                  Feature-grouped admin regression tests
│   └── types/                  Admin response types
├── server/                     Express application
│   ├── config/                 Supabase and rate-limit configuration
│   ├── controllers/            Request handlers
│   ├── middleware/             Auth, CSRF, uploads, logging, validation
│   ├── models/                 Database access and SQL migrations
│   ├── routes/                 Routes and security inventory
│   ├── scripts/                Maintained setup, documentation and test utilities
│   ├── tests/                  Vitest tests and PostgreSQL/RLS fixtures
│   ├── utils/                  Tokens, email, and application helpers
│   └── views/email/            Pug email templates
├── docs/                       Architecture and API reference
├── design-system/              Design specifications
├── .gitignore                  Rules for generated/local files
├── clean-up.md                 Public-repository cleanup policy
└── README.md                   Setup and command guide
```

Each application has its own `package.json` and `package-lock.json`. There is **no root `package.json`**, root install command, or root command that starts all three services. Local AI-tool bundles and UI archives are optional development material and are not application dependencies.

## Requirements

- **Node.js 22 or newer.**
- **npm**, supplied with Node.js. Use the committed npm lockfiles for application installs.
- **Git** if cloning the repository.
- A **Supabase project** for the running application, including its database, API keys, and the signing configuration described below.
- A **Stripe test secret key** for local API startup. The payment module initializes Stripe when imported, even if you only intend to exercise COD.
- An authenticated **SMTP account** to exercise email verification, password recovery, and delivery of order emails.
- Optional **Cloudinary credentials** for product image upload/deletion.
- Optional local **PostgreSQL 15+ and `psql`** for the RLS integration suite; these tests use a separate local database rather than the hosted Supabase project.
- Optional **Stripe CLI** for local webhook forwarding.

Commands below run from the **repository root**, unless a section states otherwise. `npm --prefix` selects the package and runs its scripts from that package directory. Blocks marked `powershell` use Windows PowerShell syntax; the npm and Node commands also work in other shells.

Check your tools:

```powershell
node --version
npm --version
git --version
```

## Install dependencies

For a fresh checkout:

```powershell
git clone https://github.com/Ayaan-22/CustomForge-supabase.git
Set-Location CustomForge-supabase
```

For an existing checkout, open a terminal at its root instead of cloning again. Install each package:

```powershell
npm --prefix server ci
npm --prefix client ci
npm --prefix admin ci
```

`npm ci` installs the committed lockfile versions. When deliberately adding or changing a dependency, use `npm --prefix <package> install <dependency>` and review both the package manifest and lockfile changes.

### Windows fallback for a broken npm launcher

If `npm --version` fails with `MODULE_NOT_FOUND` pointing into `AppData\Roaming\npm\node_modules\npm`, use the npm CLI bundled with the selected Node installation:

```powershell
$nodeInstallDir = Split-Path (Get-Command node.exe).Source
$npmCli = Join-Path $nodeInstallDir 'node_modules/npm/bin/npm-cli.js'
node $npmCli --version
node $npmCli --prefix server ci
node $npmCli --prefix client ci
node $npmCli --prefix admin ci
```

For the remaining commands, replace `npm` with `node $npmCli` in that terminal. For example, `node $npmCli --prefix server run dev`. If that CLI path is also missing, repair your Node/npm installation before continuing.

## Environment configuration

This checkout does not include `.env.example` or `.env.template` files. Create the files below manually using the templates, and replace every placeholder with values for your own development project. Do not overwrite an existing working environment file.

### Backend: `server/.env`

```dotenv
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001

SUPABASE_URL=https://YOUR_PROJECT_REFERENCE.supabase.co
SUPABASE_ANON_KEY=REPLACE_WITH_PROJECT_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_PROJECT_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET=REPLACE_WITH_PROJECT_SHARED_JWT_SIGNING_SECRET

JWT_SECRET=REPLACE_WITH_A_RANDOM_APPLICATION_SECRET
JWT_ALGORITHM=HS256
JWT_SHORT_EXPIRES_IN=15m
JWT_EXPIRES_IN=30d
JWT_REFRESH_EXPIRES_IN=30d
JWT_REFRESH_COOKIE_EXPIRES_IN=30
CSRF_SECRET=REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET

STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_YOUR_TEST_KEY
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_LISTENER_OR_ENDPOINT_SECRET

EMAIL_HOST=smtp.example.com
EMAIL_PORT=465
EMAIL_USERNAME=REPLACE_WITH_SMTP_USERNAME
EMAIL_PASSWORD=REPLACE_WITH_SMTP_PASSWORD
EMAIL_FROM=CustomForge <no-reply@example.com>

# Optional: product image upload and deletion
# CLOUDINARY_CLOUD_NAME=REPLACE_WITH_CLOUD_NAME
# CLOUDINARY_API_KEY=REPLACE_WITH_CLOUDINARY_KEY
# CLOUDINARY_API_SECRET=REPLACE_WITH_CLOUDINARY_SECRET

# Relative to server/ when started with npm --prefix server
LOG_DIR=./logs
LOG_LEVEL_FILE=info
LOG_LEVEL_CONSOLE=debug
SERVICE_NAME=CustomForge
```

Generate a new application secret locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run it separately for `JWT_SECRET` and `CSRF_SECRET`. **Do not generate `SUPABASE_JWT_SECRET` with this command:** it must match the signing secret accepted by the target Supabase project.

| Setting | Requirement and behavior |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | All three are checked during backend initialization. The service key is privileged and belongs only in backend/server tooling. |
| `SUPABASE_JWT_SECRET` | Required for authenticated database access. The current adapter signs short-lived **HS256** database JWTs with `role=authenticated` and the verified application user ID. |
| `JWT_SECRET` | Required for application JWT signing and verification. Separate from the Supabase signing secret. |
| `JWT_SHORT_EXPIRES_IN` | Access-token lifetime; default `15m`. |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | General/default and refresh-token lifetimes; default `30d`. |
| `JWT_REFRESH_COOKIE_EXPIRES_IN` | Refresh-cookie lifetime in days; default `30`. |
| `CSRF_SECRET` | Set an independent secret. The source otherwise falls back to the application JWT secret. |
| `CLIENT_URL`, `ADMIN_URL` | Exact frontend origins, without route paths. Used for allowed origins; `CLIENT_URL` also controls customer email/payment links. Update these if ports or hostnames change. |
| `STRIPE_SECRET_KEY` | Needed for API startup; use a test key locally and a live key only for a configured production deployment. |
| `STRIPE_WEBHOOK_SECRET` | Required to verify delivered Stripe webhook signatures. A CLI listener secret differs from a registered endpoint secret. |
| `EMAIL_*` | Required for actual email delivery. Port `465` uses implicit TLS; other ports require STARTTLS. Configure a sender accepted by your SMTP account. |
| `CLOUDINARY_*` | Optional for startup. Upload/deletion features return unavailable responses when credentials are absent. |
| `LOG_DIR` | Optional. Default is root `logs/`; the template places logs in ignored `server/logs/`. |
| `NODE_ENV` | Set explicitly. Development-only email routes and email fallback behavior depend on the actual environment value. |

Supabase now documents publishable/secret API keys alongside legacy `anon`/`service_role` keys. This application still uses the variable contract above and custom HS256 database JWT signing. Check [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) and [signing keys](https://supabase.com/docs/guides/auth/signing-keys) before changing project keys/signing configuration; an asymmetric signing-key migration needs compatibility work in the current adapter. An API key is not a substitute for `SUPABASE_JWT_SECRET`.

Use `server/.env` when running the documented npm commands. Database/token modules load environment values during imports. The historical `server/config/config.env` loader runs later and should not be your only source for required settings. Process/hosting environment variables can also supply the values.

For development without sending email, **omit** `EMAIL_USERNAME` and `EMAIL_PASSWORD` rather than leaving their placeholders. With `NODE_ENV=development`, the mailer logs that an email would be sent. That does not deliver a verification link, so a complete registration/verification flow still needs working SMTP. Email previews are available separately below.

Optional rate-limit controls are documented in [server/config/rateLimit.js](server/config/rateLimit.js). `RATE_LIMIT_IN_DEV=true` enables the configured development limits; `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` set the base window/max, with additional per-route settings in that file. Production limits cannot be disabled with the development bypass flags.

### Frontends: `client/.env.local` and `admin/.env.local`

Create the same server-only setting in both files:

```dotenv
API_BACKEND_URL=http://localhost:5000
```

Next.js forwards `/api/v1/*` requests to Express through its configured rewrites. The storefront browser transport always uses its own origin. For the admin dashboard, leave **`NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_API_URL` unset** to use its same-origin rewrite; those legacy public variables still override the admin transport if supplied.

Keep Supabase service keys, signing secrets, Stripe secret keys, SMTP passwords, and Cloudinary secrets out of both frontend environments and all `NEXT_PUBLIC_*` variables. The current hosted Stripe Checkout flow does not require a frontend Stripe publishable key.

Configure the backend origin before building Next.js and restart/rebuild when it changes. Avoid switching between `localhost` and `127.0.0.1` during an authenticated session: they are different cookie hosts. Use the same hostname consistently in the browser and frontend-origin settings.

## Database setup and migrations

Use the Supabase **SQL Editor** against your intended project. The authoritative schema and migrations are under [server/models/migrations/](server/models/migrations/). There is no Supabase CLI migration project configured in this repository.

For a fresh database, execute these files in order, waiting for each to succeed:

| Order | SQL file | Purpose |
| --- | --- | --- |
| 1 | [schema.sql](server/models/migrations/schema.sql) | Base extensions, tables, and initial schema. |
| 2 | [add_stripe_customer_id.sql](server/models/migrations/add_stripe_customer_id.sql) | Compatibility addition for Stripe customer/payment metadata. These columns already exist in the current base schema; additions are guarded. |
| 3 | [20260430_security_hardening.sql](server/models/migrations/20260430_security_hardening.sql) | Refresh-token storage, indexes, and initial RLS hardening. |
| 4 | [20261002_public_storefront_rls.sql](server/models/migrations/20261002_public_storefront_rls.sql) | Public catalog grants/projections, protected private tables, review guard, and security-invoker views. Requires PostgreSQL 15+. |
| 5 | [20261003_atomic_checkout.sql](server/models/migrations/20261003_atomic_checkout.sql) | Atomic, owner-scoped cart checkout with authoritative totals, inventory locking, and retry handling. |
| 6 | [20261004_admin_analytics.sql](server/models/migrations/20261004_admin_analytics.sql) | Admin analytics RPC and supporting indexes. |
| 7 | [20261004_cancel_unpaid_order.sql](server/models/migrations/20261004_cancel_unpaid_order.sql) | Eligible unpaid COD cancellation with inventory restoration. |

For an existing project, inspect which schema changes have already been applied and apply the missing migrations in sequence. Back up the target database before changing an existing deployment. Do not rerun the older hardening migration after the public-storefront migration: later migrations establish the current access policy. Do not use `admin/scripts/schema.sql` as the setup authority; it is a stale alternate schema.

Use the canonical migrations and maintained SQL/RLS tests to review database permissions. Empty product tables are valid; add your own catalog through the admin interface or use the optional demo seed below.

The schema does not create a default administrator or import demo products automatically. Use the account and optional demo-catalog workflows below.

## Run locally

After dependency installation, configuration, and database setup, open **three terminals**, each at the repository root.

Terminal 1 — API:

```powershell
npm --prefix server run dev
```

Terminal 2 — storefront:

```powershell
npm --prefix client run dev -- --port 3000
```

Terminal 3 — admin:

```powershell
npm --prefix admin run dev -- --port 3001
```

The explicit admin port prevents both Next applications from trying to use port 3000. Stop a development process with `Ctrl+C` in its terminal.

Open:

- Storefront: `http://localhost:3000`
- Admin login: `http://localhost:3001/login`
- Backend health: `http://localhost:5000/api/v1/health`

Check the backend and both rewrites from another terminal:

```powershell
Invoke-RestMethod 'http://localhost:5000/api/v1/health'
Invoke-RestMethod 'http://localhost:3000/api/v1/health'
Invoke-RestMethod 'http://localhost:3001/api/v1/health'
Invoke-RestMethod 'http://localhost:3000/api/v1/products?limit=2'
```

The health route confirms that Express responds; it does not certify database access, email delivery, or payment settlement. A catalog request checks a real public data path.

### API sessions and CSRF

For a manual API client, fetch a CSRF token and retain the returned cookies before sending a mutating request:

```powershell
$csrfResponse = Invoke-RestMethod `
  -Uri 'http://localhost:5000/api/v1/auth/csrf-token' `
  -SessionVariable customForgeSession
$csrfHeaders = @{ 'X-CSRF-Token' = $csrfResponse.data.csrfToken }
```

Subsequent calls need `-WebSession $customForgeSession` and `-Headers $csrfHeaders`. Protected routes additionally need `Authorization: Bearer <application-access-token>`; operations protected by an enabled second factor require `X-2FA-Token`. Refresh/logout rotate or clear session state, so fetch a current CSRF token after session changes. The application transports implement this automatically. A token copied without its bound cookies is insufficient.

The signed Stripe webhook uses its own verification path and raw request body. Refer to the [route security map](docs/api/route-security-map.md) for the exact public, customer, admin, and development boundaries.

## Customer and admin accounts

1. Configure working SMTP and the correct `CLIENT_URL`.
2. Open the storefront `/register` page and create an account. Supply a name, valid email, and password; passwords must be between 8 and 128 characters.
3. Follow the verification email. If the link expires or delivery fails, use the verification/resend flow; the signed-out resend requires proof of the account password.
4. Sign in and use the account pages for addresses and two-factor setup. Most customer data operations require verified email.

There are no committed default login credentials. Signing up through the frontend cannot grant an admin role.

### Bootstrap an administrator in your own development project

Register and verify the intended account through the application first. In Supabase SQL Editor, inspect it and then promote that **specific verified, active account**:

```sql
select id, email, role, is_email_verified, active
from public.users
where email = 'admin@example.com';

update public.users
set role = 'admin', updated_at = now()
where email = 'admin@example.com'
  and is_email_verified = true
  and active = true
returning id, email, role;
```

Replace `admin@example.com` with the intended account email. This changes database permissions for that account. Sign out and sign in again to obtain current session/role state, then open the admin login. Configure two-factor authentication for sensitive admin work. Do not manufacture password/token hashes or mark an account verified to bypass the normal registration flow.

## Stripe configuration and checkout

For local development, use a Stripe sandbox/test key in `server/.env` and configure webhook forwarding in a fourth terminal. Install the [Stripe CLI](https://docs.stripe.com/cli/install), then run:

```powershell
stripe login
stripe listen --forward-to localhost:5000/api/v1/payment/webhook
```

Copy the listener's `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, then restart the backend. Keep the listener running while testing Checkout. For a deployment, register the public HTTPS API endpoint `/api/v1/payment/webhook` and use that endpoint's signing secret instead. The application handles `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, and `charge.refunded` events. See [Stripe webhook guidance](https://docs.stripe.com/webhooks).

Use `NODE_ENV=development` for local CLI forwarding. The production webhook handler additionally checks the sender IP against its Stripe allowlist; a loopback CLI delivery will be rejected. Production verification must use the deployed endpoint with correctly configured proxy headers and the actual Stripe delivery source.

A complete application test uses a verified customer, shipping address, nonempty cart, and sufficient stock. Create an order through the storefront, choose the implemented Stripe path, finish hosted Checkout using Stripe test-mode payment details, then confirm the order state after the signed webhook arrives. Browser success redirects alone do not prove settlement. Checkout also depends on the matching `CLIENT_URL`, the atomic-checkout migration, and authenticated database JWT configuration.

## Tests and code checks

### Standard package checks

Run the package tests:

```powershell
npm --prefix server test
npm --prefix client test
npm --prefix admin test
```

Run both frontend linters and type checks:

```powershell
npm --prefix client run lint
npm --prefix admin run lint
npm --prefix client run typecheck
npm --prefix admin run typecheck
```

The backend has no `lint`, `typecheck`, or `build` npm script. Its database-access source guard and focused security suite are:

```powershell
npm --prefix server run check:db-architecture
npm --prefix server run test:security
```

The security script runs three selected test files; it is a subset of the backend suite. Other security tests still require the full backend test command. Normal backend Vitest setup replaces provider configuration with isolated test values and mocks. The real PostgreSQL suite and storefront sandbox checkout exercise separate integration boundaries.

For watch mode, run the relevant command in its own terminal:

```powershell
npm --prefix server run test:watch
npm --prefix client run test:watch
npm --prefix admin run test:watch
```

Admin's optional Vitest UI and examples of focused test runs:

```powershell
npm --prefix admin run test:ui
npm --prefix server test -- tests/cart/cartTotals.test.js
npm --prefix client test -- tests/transport/apiClient.test.ts
npm --prefix admin test -- tests/transport/transport.test.ts
```

Use the output from the suite you actually ran; keep assertions current when application behavior changes.

### Real PostgreSQL/RLS integration

```powershell
npm --prefix server run test:rls
```

This requires a running **dedicated local** PostgreSQL instance and `psql`. The runner does not load the application `.env` or hosted credentials. It creates a uniquely named database, applies migrations and SQL assertions, and drops that database in its cleanup path. It may create cluster-wide `anon`, `authenticated`, and `service_role` roles; use a disposable test cluster with a superuser rather than a shared application cluster.

Defaults and overrides:

| Variable | Default |
| --- | --- |
| `PSQL_BIN` | Windows: `C:/Program Files/PostgreSQL/18/bin/psql.exe`; other systems: `psql` on `PATH` |
| `RLS_TEST_HOST` | `127.0.0.1`; only loopback hosts are permitted |
| `RLS_TEST_PORT` | `55439` |
| `RLS_TEST_USER` | `postgres` |
| PostgreSQL authentication | Normal libpq settings, such as `PGPASSWORD` or a configured password file |

For example, adjust an already running dedicated test instance:

```powershell
$env:PSQL_BIN = 'C:/Program Files/PostgreSQL/18/bin/psql.exe'
$env:RLS_TEST_HOST = '127.0.0.1'
$env:RLS_TEST_PORT = '55439'
$env:RLS_TEST_USER = 'postgres'
npm --prefix server run test:rls
```

#### Optional: create a dedicated test cluster on Windows

Install PostgreSQL first and adjust the binary directory if your version differs. From the repository root, initialize the directory **once**, choosing a test-cluster password when prompted:

```powershell
$rlsPgBin = 'C:/Program Files/PostgreSQL/18/bin'
$rlsDataDir = Join-Path (Get-Location).Path 'scratch/rls-postgres'
New-Item -ItemType Directory -Path scratch -Force | Out-Null
& "$rlsPgBin/initdb.exe" -D $rlsDataDir -U postgres -A scram-sha-256 -W
```

Start that cluster, authenticate the test runner with the same password, and stop the cluster when finished:

```powershell
& "$rlsPgBin/pg_ctl.exe" -D $rlsDataDir -l "$rlsDataDir/server.log" -o '-h 127.0.0.1 -p 55439' -w start
$env:PSQL_BIN = "$rlsPgBin/psql.exe"
$env:RLS_TEST_HOST = '127.0.0.1'
$env:RLS_TEST_PORT = '55439'
$env:RLS_TEST_USER = 'postgres'
$rlsPassword = Read-Host 'Test-cluster password' -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $rlsPassword).Password
try {
    npm --prefix server run test:rls
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    & "$rlsPgBin/pg_ctl.exe" -D $rlsDataDir -w stop
}
```

The cluster files remain under ignored `scratch/rls-postgres/`; reuse them on later runs by starting the cluster without repeating `initdb`. This example removes only the temporary password environment variable, not any repository files.

## Catalog and server tools

### Optional demo catalog

The supported demo tool contains 40 fictional products with `CF-DEMO-` SKUs and matching local image references. Its default command validates the catalog offline without contacting a database:

```powershell
npm --prefix server run seed
```

To add the demo products to an intended Supabase development project:

```powershell
node server/scripts/catalog/seed-demo-catalog.js --apply --project=YOUR_PROJECT_REFERENCE
```

Replace the project placeholder with the reference in your configured Supabase hostname. The apply command loads `server/.env`, checks the exact target and uses additive SKU inserts that leave existing products unchanged. Manage real products through the admin catalog; no script resets user or order data.

### Regenerate the route security map

```powershell
npm --prefix server run docs:routes
```

This updates [docs/api/route-security-map.md](docs/api/route-security-map.md) from the source route inventory. Review the generated Markdown diff when routes change. The [server script guide](server/scripts/README.md) lists all retained utilities and prerequisites. One-off HTTP, provider, preview and incident-repair helpers are retired.

## Production builds and deployment

Set the deployment configuration before building: actual HTTPS `CLIENT_URL`/`ADMIN_URL`, appropriate backend origin for both Next applications, working SMTP, Cloudinary if needed, and the intended Stripe environment/webhook secret. Apply and verify the target migrations first.

Build the two frontends:

```powershell
npm --prefix client run build
npm --prefix admin run build
```

Start each application in a separate terminal/process. For a local process example, set the API environment explicitly:

```powershell
# Terminal 1: API
$env:NODE_ENV = 'production'
npm --prefix server start
```

```powershell
# Terminal 2: built storefront
npm --prefix client start -- --port 3000
```

```powershell
# Terminal 3: built admin
npm --prefix admin start -- --port 3001
```

`next start` requires a successful build of that application. The API runs JavaScript directly and has no compilation step. Production hosting must manage all three services or deploy them independently; no deployment orchestrator is configured here.

Deployment requirements:

- Keep backend secrets in the server's runtime environment. Inject `API_BACKEND_URL` into the frontend build/configuration environment; it must be reachable from the Next server.
- Serve the customer and admin sites over HTTPS. Production refresh cookies are `Secure`, HttpOnly, and `SameSite=Strict`; keep browser API traffic on each frontend's own origin through the rewrite.
- Set exact frontend origins. Development permits local origins more broadly; production does not. Frontend `NEXT_PUBLIC_*` values, if used, are build-time browser configuration and need a rebuild to change.
- Expose the signed Stripe webhook through HTTPS without modifying its raw body. Verify delivery against a real application test order in the intended environment.
- The API currently trusts one proxy hop. Match that assumption to the hosting topology and preserve forwarded headers correctly.
- Retain/monitor logs and backups appropriately. The filesystem destinations are ignored by Git, but production storage and retention are deployment responsibilities.
- Verify the target schema, authenticated customer/admin flows, signed payment webhooks and order consistency in the deployment environment. Do not present unavailable payment/refund functions as supported features.

Review production dependency advisories when preparing a release:

```powershell
npm --prefix server audit --omit=dev
npm --prefix client audit --omit=dev
npm --prefix admin audit --omit=dev
```

Dependency audits contact the package registry and report the state at the time they run. Review fixes and lockfile changes rather than applying unreviewed dependency upgrades.

## Local production preview

The storefront supports `FORGE_PREVIEW=1`, which puts its build in `.forge-preview/` instead of `.next/`. From a PowerShell terminal at the root:

```powershell
$env:FORGE_PREVIEW = '1'
npm --prefix client run build
npm --prefix client start -- --port 3100
```

Keep `FORGE_PREVIEW=1` set for both the build and start commands. Use `http://localhost:3100`. For authenticated/payment testing against a production-mode API, align `CLIENT_URL` with this preview origin and restart the backend. If admin uses a different preview port, align `ADMIN_URL` as well. For normal storefront builds after stopping the preview:

```powershell
Remove-Item Env:\FORGE_PREVIEW -ErrorAction SilentlyContinue
```

Use the browser's performance and accessibility tools against the current running preview when needed. Temporary screenshots or measurements are disposable; do not add one-off QA scripts or report archives to this repository.

## Command reference

All application npm scripts currently declared in the manifests are listed below. Commands use repository-root paths.

| Package | Command | Purpose |
| --- | --- | --- |
| Storefront | `npm --prefix client run dev -- --port 3000` | Development server. |
| Storefront | `npm --prefix client run build` | Production build. |
| Storefront | `npm --prefix client start -- --port 3000` | Serve an existing production build. |
| Storefront | `npm --prefix client run lint` | ESLint. |
| Storefront | `npm --prefix client run typecheck` | TypeScript checks. |
| Storefront | `npm --prefix client test` | Vitest, one run. |
| Storefront | `npm --prefix client run test:watch` | Vitest watch mode. |
| Admin | `npm --prefix admin run dev -- --port 3001` | Development server. |
| Admin | `npm --prefix admin run build` | Production build. |
| Admin | `npm --prefix admin start -- --port 3001` | Serve an existing production build. |
| Admin | `npm --prefix admin run lint` | ESLint. |
| Admin | `npm --prefix admin run typecheck` | TypeScript checks. |
| Admin | `npm --prefix admin test` | Vitest, one run. |
| Admin | `npm --prefix admin run test:watch` | Vitest watch mode. |
| Admin | `npm --prefix admin run test:ui` | Vitest UI. |
| API | `npm --prefix server run dev` | Node watch mode. |
| API | `npm --prefix server start` | API server. |
| API | `npm --prefix server test` | Backend Vitest, one run. |
| API | `npm --prefix server run test:watch` | Backend Vitest watch mode. |
| API | `npm --prefix server run test:security` | Selected security regression tests. |
| API | `npm --prefix server run check:db-architecture` | Source guard for database access boundaries. |
| API | `npm --prefix server run test:rls` | Real disposable local PostgreSQL/RLS tests. |
| API | `npm --prefix server run docs:routes` | Regenerate the route security map. |
| API | `npm --prefix server run seed` | Validate the demo catalog offline; database writes require explicit apply/project arguments. |

Direct Node utilities, SQL files, environment prerequisites, and side effects are covered in the relevant sections above. To inspect an installed package's script list:

```powershell
npm --prefix server run
npm --prefix client run
npm --prefix admin run
```

## Troubleshooting

| Symptom | Check or resolution |
| --- | --- |
| Root npm command reports missing `package.json` | Select `server`, `client`, or `admin` with `--prefix`, or change into that package directory. |
| npm launcher reports a missing global `npm-cli.js` | Use the bundled Node/npm fallback in the installation section. |
| API reports missing Supabase variables or `JWT_SECRET` | Configure `server/.env`; start with `npm --prefix server ...` so dotenv uses the expected directory. Placeholder strings are not working credentials. |
| Public catalog works, but signed-in database calls fail | Check `SUPABASE_JWT_SECRET` and the project's accepted signing configuration. Application JWTs are not database JWTs. |
| `checkout_cart`, `admin_analytics`, or cancellation RPC is missing | Check the migration order and target project; apply the missing migration and verify PostgREST schema availability. |
| Next requests return `ECONNREFUSED`, 502, or 404 for `/api/v1` | Start Express; verify the Next app's `API_BACKEND_URL`; restart/rebuild after configuration changes. |
| Both Next apps want port 3000 | Pass `-- --port 3001` to the admin command explicitly. |
| Production start cannot find a build | Run that package's build first; for a storefront preview, use the same `FORGE_PREVIEW` setting for build and start. |
| Login/refresh or other writes return `CSRF_INVALID` | Keep the CSRF token and bound cookies together; use the same hostname and current token after session rotation. For a manual API client, retain its web session. |
| Admin calls bypass the rewrite unexpectedly | Unset `NEXT_PUBLIC_API_BASE_URL`/`NEXT_PUBLIC_API_URL` and rebuild; admin still reads these legacy variables. |
| Production browser origin is rejected | Match `CLIENT_URL`/`ADMIN_URL` to the exact scheme, host, and port; restart the API after changing them. |
| No verification/reset email arrives | Check SMTP credentials, sender, TLS port, inbox, and server logs. Development log-only email does not send a message. Use the recovery/resend UI after correcting configuration. |
| Stripe startup or webhook signature fails | Supply the correct Stripe key and listener/endpoint signing secret; restart Express and keep the raw webhook body intact. |
| Local Stripe CLI delivery returns 403 in production mode | The production sender-IP guard rejects loopback forwarding. Use development mode locally and actual Stripe delivery for production verification. |
| A browser payment success page appears but order remains unpaid | Inspect webhook delivery and application logs. Redirect success alone does not update/verify settlement. |
| PayPal, saved-card enrollment, refund, or unsupported cancellation returns unavailable | Consult current feature limitations; those flows are intentionally incomplete. |
| Cloudinary upload/deletion returns unavailable | Configure all three Cloudinary credentials in the backend. |
| RLS tests cannot connect or `psql` is not found | Start the dedicated local cluster and set `PSQL_BIN`, `RLS_TEST_PORT`, and authentication appropriately. Do not point this runner at hosted Supabase. |
| TLS certificate verification fails | Correct certificates, trust configuration, or network conditions. The API refuses `NODE_TLS_REJECT_UNAUTHORIZED=0`. |

## Repository hygiene

This is a personal public repository. Keep application source, manifests, lockfiles, SQL migrations, automated tests, static assets and maintained documentation. See [clean-up.md](clean-up.md) for the cleanup policy and [.gitignore](.gitignore) for local exclusions.

Dependencies, builds, compiler caches, test results, secrets, logs, uploads, backups and local tool bundles are ignored. The entire scratch workspace and report-output area are local-only, without exceptions for browser helpers or final QA reports. Do not keep assistant-generated QA archives or scripts tied to one account, project or machine.

Ignoring a path does not delete it or remove an already tracked file from Git. Review changes before committing, and preserve database/recovery data separately from disposable verification output.

## Documentation

Start at the [documentation index](docs/README.md).

| Topic | Reference |
| --- | --- |
| Architecture | [System overview](docs/architecture/system-overview.md) |
| Schema | [Database architecture](docs/architecture/database-schema.md) and [canonical migrations](server/models/migrations/) |
| API routes and access | [Route security map](docs/api/route-security-map.md), [endpoint reference](docs/api/endpoints.md) |
| Authentication | [Auth flow](docs/api/auth-flow.md); current route ownership is in the route map. |
| Orders and totals | [Cart/orders](docs/api/cart-orders.md); canonical checkout rules are in the migrations. |
| Backend utilities | [Server scripts](server/scripts/README.md) |
| Automated backend tests | [Feature/security suite guide](server/tests/README.md) |
| Automated storefront tests | [Feature suite guide](client/tests/README.md) |
| Automated admin tests | [Feature suite guide](admin/tests/README.md) |
| Shared design rules | [Design-system index](design-system/README.md) |
| Storefront design | [Component and asset guide](client/REDESIGN.md), [design system](design-system/FORGE.md) |
| Admin design | [Design system](design-system/ADMIN.md) |
| Historical setup guide | [Getting started](docs/guides/getting-started.md); use this README where the older guide differs. |
| Cleanup | [Repository cleanup policy](clean-up.md) |

When code and older documentation differ, prefer current package scripts, routes, configuration and canonical migrations. Update documentation with behavior changes rather than accumulating dated QA reports.
