# CustomForge deletion checklist

Updated **October 6, 2026 (Asia/Karachi)**. Paths are relative to the repository root. This is the single maintained cleanup checklist for a personal, public GitHub project; no separate QA manifest or report is created.

**Status: proposed deletion batches remain pending.** Unchecked boxes identify proposals, not completed removals or approval. Completed documentation cleanup is recorded separately below. Keep automated regression/security tests, as explicitly requested by the owner.

## Completed design-system cleanup

The owner separately requested updating the design system and removing redundant files. Useful shared/navigation guidance was consolidated into the maintained [design-system index](design-system/README.md), [storefront guide](design-system/FORGE.md) and [admin guide](design-system/ADMIN.md).

- [x] `design-system/MASTER.md` — removed the superseded palette/layout guidance after consolidating shared principles.
- [x] `design-system/pages/navbar.md` — merged navigation guidance into the storefront guide.
- [x] `design-system/pages/` — removed after it was empty.

This documentation cleanup did not execute any of the pending QA, source, asset or cache deletion proposals below. Runtime styles and application components were unchanged.

## Current organization

The organization task moved existing files and repaired their paths; it did not execute the deletion proposals below.

| Area | Layout |
| --- | --- |
| Server scripts | catalog/, docs/, checks/, tests/ and legacy/ (including legacy/sql/). See the [script guide](server/scripts/README.md). |
| Automated tests | Feature/security folders, helpers/ and integration/rls/. See the [test guide](server/tests/README.md). |
| Storefront tests | client/tests/ feature folders, separate from app/, components/, lib/ and services/. See the [test guide](client/tests/README.md). These maintained regressions are preserved. |
| Admin tests | admin/tests/ feature folders, separate from app/ and lib/. See the [test guide](admin/tests/README.md). These maintained regressions are preserved. |
| Scratch QA | checks/, rewrites/, baselines/, harnesses/ and tooling/. All remain ignored and on this deletion checklist. |
| Local database | scratch/frontend-audit-postgres/ remains at its original location. |

Do not run the legacy repair/seeding tools or scratch rewrite helpers simply because they have been grouped. Their purpose and pending deletion status are unchanged. The QA harness dependency junction still targets admin/node_modules; the pnpm junction now targets scratch/tooling/forge-phase5-audit.

## Scope at a glance

| Group | Inventory | Status |
| --- | --- | --- |
| One-off QA/report batch | 280 ordinary files, 2 junction/link entries | Proposed removal; full archive/cache scope approval remains pending. |
| Report library | 212 files, 28.14 MiB | Exact file checklist below. |
| Scratch QA | 18 selected entries, 58 ordinary files | Excludes the PostgreSQL data directory. |
| Retired server scripts/SQL | 8 files | Exact paths and reasons below. |
| Frontend import-graph candidates | 62 client + 46 admin = 108 files | Conditional source review; not part of the one-off QA batch. |
| Additional maintenance candidates | Three backend model helpers, one alternate schema, one alternate lockfile | Conditions below; do not delete blindly. |
| Public asset candidates | 23 client + 11 admin | No literal filename reference found; database URL checks required. |

Automatic approval review rejected the earlier broad deletion batch because it included the entire historical report archive and package-manager state beyond narrowly identified QA helpers. No deletion ran. Listing the scope here does not approve execution. The three original audit/migration reports and the tracked legacy seeder are explicitly included below so those wider removals are reviewable.

## 1. Proposed one-off QA removal

### Scratch targets

Delete only these entries, never the whole scratch directory:

- [ ] `scratch/checks/admin-auth-live-check.mjs` — One-session authenticated API probe.
- [ ] `scratch/checks/admin-log-live-check.mjs` — One-session activity-log API probe.
- [ ] `scratch/baselines/admin-redesign/` — Saved build configuration snapshots.
- [ ] `scratch/checks/admin-theme-audit.mjs` — One-off theme contrast/source report generator.
- [ ] `scratch/rewrites/admin-theme-colors.mjs` — Completed theme rewrite utility; not a maintained test.
- [ ] `scratch/checks/admin-theme-smoke.mjs` — One-off page/HTTP probe.
- [ ] `scratch/rewrites/admin-unify-commerce.mjs` — Completed source rewrite utility.
- [ ] `scratch/rewrites/admin-unify-css.mjs` — Completed source rewrite utility.
- [ ] `scratch/checks/admin-universal-audit.mjs` — One-off layout/source audit generator.
- [ ] `scratch/harnesses/admin-visual-qa/` — Isolated sample-data QA application, fixtures and images. Unlink its node_modules junction without following admin/node_modules.
- [ ] `scratch/baselines/forge-controls-build-baseline.json` — Saved build configuration snapshot.
- [ ] `scratch/baselines/forge-dropdown-build-baseline.json` — Saved build configuration snapshot.
- [ ] `scratch/baselines/forge-live-auth-build-baseline.json` — Saved build configuration snapshot.
- [ ] `scratch/tooling/forge-phase5-audit/` — Local Lighthouse setup and hard-coded browser runner.
- [ ] `scratch/rewrites/normalize-operations.mjs` — Completed source rewrite utility.
- [ ] `scratch/checks/payment-navigation-browser.mjs` — Machine-specific browser QA helper.
- [ ] `scratch/rewrites/theme-commerce.mjs` — Completed source rewrite utility.
- [ ] `scratch/checks/wishlist-browser.mjs` — Machine-specific browser QA helper.

### Server scripts and SQL

- [ ] `server/scripts/legacy/audit-public-catalog.js` — One-off hosted public-catalog/privacy probe; its package command has been retired.
- [ ] `server/scripts/legacy/preview-emails.js` — Throwaway sample-email HTML/text generator; maintained email tests remain.
- [ ] `server/scripts/legacy/repair-empty-checkouts.js` — Completed repair bound to a specific project and historical orders.
- [ ] `server/scripts/legacy/seed-supabase.js` — Retired destructive seeder relying on deleted mock data; replaced by the additive demo tool.
- [ ] `server/scripts/legacy/verify-http-readiness.js` — One-off local HTTP/CSRF/webhook probe.
- [ ] `server/scripts/legacy/verify-stripe-sandbox.js` — One-off provider object/payment/refund probe.
- [ ] `server/scripts/legacy/sql/audit-storefront-rls.sql` — Standalone audit query; canonical migrations and maintained SQL tests remain.
- [ ] `server/scripts/legacy/sql/repair-failed-checkout.sql` — Incident-specific order repair SQL, not a schema migration.

After removing both SQL files, remove the empty `server/scripts/legacy/sql/` directory. Keep `server/models/migrations/`: it is the canonical schema and has a different purpose.

The server manifest already points `npm --prefix server run seed` to `scripts/catalog/seed-demo-catalog.js`, which validates offline by default. The retired public-catalog audit command is removed. Database writes still require the maintained seed tool's explicit `--apply` and project selection.

### Other QA artifacts and local cache

- [ ] `CLAUDE_AUDIT.md` — standalone dated technical audit/roadmap.
- [ ] `.pnpm-store/` — local package-manager state linked to the retiring Lighthouse workspace. Unlink the junction below first; do not traverse it.
- [ ] `docs/reports/` — all 212 ordinary files listed in section 2, including summaries, indexes, screenshots, API/build/test snapshots, Lighthouse measurements, the audit runner and local cleanup/organization records. Remove the empty folder tree afterward.

Junction/link entries included in the proposed QA batch:

- [ ] `scratch/harnesses/admin-visual-qa/node_modules` → `admin/node_modules`. Remove the link entry only; never recurse into its target.
- [ ] `.pnpm-store/v11/projects/ba477ff06f309f3a106cfb8fb9a7ba3b` → `scratch/tooling/forge-phase5-audit`. Remove the link entry only; never recurse into its target.

The original report names `auth-audit.md`, `schema-alignment.md` and `supabase-migration.md` were tracked before the organization task. Their current organized paths are listed below. Their old paths already appear as deletions from the earlier move; those are not new deletions from this checklist. Do not revert or mix in unrelated working-tree changes.

## 2. Full report file inventory

Every entry below exists at the time of this update. This is the exhaustive expansion of the proposed `docs/reports/` removal, rather than a hidden wildcard or blanket untracking instruction.

### Report index — 1 file

- [ ] `docs/reports/README.md`

### admin — 20 files

- [ ] `docs/reports/admin/README.md`
- [ ] `docs/reports/admin/evidence/README.md`
- [ ] `docs/reports/admin/evidence/forge-admin-layout-repair-http.json`
- [ ] `docs/reports/admin/evidence/forge-admin-live-api-validation.json`
- [ ] `docs/reports/admin/evidence/forge-admin-logs-http.json`
- [ ] `docs/reports/admin/evidence/forge-admin-logs-live.json`
- [ ] `docs/reports/admin/evidence/forge-admin-redesign-build.txt`
- [ ] `docs/reports/admin/evidence/forge-admin-redesign-lint.json`
- [ ] `docs/reports/admin/evidence/forge-admin-theme-build.txt`
- [ ] `docs/reports/admin/evidence/forge-admin-theme-contrast.json`
- [ ] `docs/reports/admin/evidence/forge-admin-theme-http.json`
- [ ] `docs/reports/admin/evidence/forge-admin-universal-build.txt`
- [ ] `docs/reports/admin/evidence/forge-admin-universal-http.json`
- [ ] `docs/reports/admin/evidence/forge-admin-universal-lint.json`
- [ ] `docs/reports/admin/evidence/forge-admin-universal-source.json`
- [ ] `docs/reports/admin/forge-admin-layout-repair-validation.md`
- [ ] `docs/reports/admin/forge-admin-logs-validation.md`
- [ ] `docs/reports/admin/forge-admin-redesign-validation.md`
- [ ] `docs/reports/admin/forge-admin-theme-validation.md`
- [ ] `docs/reports/admin/forge-admin-universal-validation.md`

### artifacts — 27 files

- [ ] `docs/reports/artifacts/README.md`
- [ ] `docs/reports/artifacts/admin/forge-admin-theme-contrast-2026-10-06T11-58-42-120Z.json`
- [ ] `docs/reports/artifacts/admin/forge-admin-universal-source-2026-10-06T11-58-45-045Z.json`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-discovery-mobile.report.html`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-discovery-mobile.report.json`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-lighthouse-mobile-optimized.report.html`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-lighthouse-mobile-optimized.report.json`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-lighthouse-mobile.report.html`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-lighthouse-mobile.report.json`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-phase2-mobile-before-prefetch.report.html`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-phase2-mobile-before-prefetch.report.json`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-phase2-mobile-prefetch.report.html`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-phase2-mobile-prefetch.report.json`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-phase2-mobile.report.html`
- [ ] `docs/reports/artifacts/archive/lighthouse/forge-phase2-mobile.report.json`
- [ ] `docs/reports/artifacts/archive/release/admin-dependency-fix.txt`
- [ ] `docs/reports/artifacts/archive/release/admin-production-dependencies.json`
- [ ] `docs/reports/artifacts/archive/release/backend-smoke.log`
- [ ] `docs/reports/artifacts/archive/release/client-dependency-fix.txt`
- [ ] `docs/reports/artifacts/archive/release/client-production-dependencies.json`
- [ ] `docs/reports/artifacts/archive/release/server-dependency-fix.txt`
- [ ] `docs/reports/artifacts/archive/release/server-production-dependencies.json`
- [ ] `docs/reports/artifacts/docs-organization-edits.json`
- [ ] `docs/reports/artifacts/docs-organization-indexes.json`
- [ ] `docs/reports/artifacts/docs-organization-plan.json`
- [ ] `docs/reports/artifacts/docs-organization-verification.json`
- [ ] `docs/reports/artifacts/scratch-cleanup-20261006.json`

### authentication — 6 files

- [ ] `docs/reports/authentication/README.md`
- [ ] `docs/reports/authentication/auth-audit.md`
- [ ] `docs/reports/authentication/auth-credential-access.md`
- [ ] `docs/reports/authentication/email-remediation.md`
- [ ] `docs/reports/authentication/login-session-repair.md`
- [ ] `docs/reports/authentication/verification-recovery-remediation.md`

### commerce — 4 files

- [ ] `docs/reports/commerce/README.md`
- [ ] `docs/reports/commerce/atomic-checkout-repair.md`
- [ ] `docs/reports/commerce/checkout-total-remediation.md`
- [ ] `docs/reports/commerce/wishlist-remediation.md`

### database — 5 files

- [ ] `docs/reports/database/README.md`
- [ ] `docs/reports/database/demo-catalog-seed.md`
- [ ] `docs/reports/database/public-storefront-rls.md`
- [ ] `docs/reports/database/schema-alignment.md`
- [ ] `docs/reports/database/supabase-migration.md`

### release — 66 files

- [ ] `docs/reports/release/README.md`
- [ ] `docs/reports/release/evidence/README.md`
- [ ] `docs/reports/release/evidence/admin-build.txt`
- [ ] `docs/reports/release/evidence/admin-dependencies.json`
- [ ] `docs/reports/release/evidence/admin-lint.txt`
- [ ] `docs/reports/release/evidence/admin-tests.txt`
- [ ] `docs/reports/release/evidence/admin-typecheck.txt`
- [ ] `docs/reports/release/evidence/client-build.txt`
- [ ] `docs/reports/release/evidence/client-dependencies.json`
- [ ] `docs/reports/release/evidence/client-lint.txt`
- [ ] `docs/reports/release/evidence/client-tests.txt`
- [ ] `docs/reports/release/evidence/client-typecheck.txt`
- [ ] `docs/reports/release/evidence/db-architecture.txt`
- [ ] `docs/reports/release/evidence/diff-check.txt`
- [ ] `docs/reports/release/evidence/frontend-search-inventory.txt`
- [ ] `docs/reports/release/evidence/hosted-public-catalog.txt`
- [ ] `docs/reports/release/evidence/http-smoke.txt`
- [ ] `docs/reports/release/evidence/local-rls.txt`
- [ ] `docs/reports/release/evidence/removed-next-routes.txt`
- [ ] `docs/reports/release/evidence/server-dependencies.json`
- [ ] `docs/reports/release/evidence/server-security-tests.txt`
- [ ] `docs/reports/release/evidence/server-tests.txt`
- [ ] `docs/reports/release/evidence/storefront-desktop.jpg`
- [ ] `docs/reports/release/evidence/storefront-mobile.jpg`
- [ ] `docs/reports/release/evidence/workspace-change-manifest.txt`
- [ ] `docs/reports/release/final-production-readiness.md`
- [ ] `docs/reports/release/frontend-findings.json`
- [ ] `docs/reports/release/frontend-findings.md`
- [ ] `docs/reports/release/frontend-production-audit.md`
- [ ] `docs/reports/release/remediation/README.md`
- [ ] `docs/reports/release/remediation/admin-build.txt`
- [ ] `docs/reports/release/remediation/admin-dependencies.json`
- [ ] `docs/reports/release/remediation/admin-dependency-tree.json`
- [ ] `docs/reports/release/remediation/admin-dependency-upgrade.txt`
- [ ] `docs/reports/release/remediation/admin-lint.txt`
- [ ] `docs/reports/release/remediation/admin-peer-fix.txt`
- [ ] `docs/reports/release/remediation/admin-runtime.txt`
- [ ] `docs/reports/release/remediation/admin-tests.txt`
- [ ] `docs/reports/release/remediation/admin-typecheck.txt`
- [ ] `docs/reports/release/remediation/baseline-hashes.json`
- [ ] `docs/reports/release/remediation/client-build.txt`
- [ ] `docs/reports/release/remediation/client-dependencies.json`
- [ ] `docs/reports/release/remediation/client-dependency-upgrade.txt`
- [ ] `docs/reports/release/remediation/client-lint.txt`
- [ ] `docs/reports/release/remediation/client-runtime.txt`
- [ ] `docs/reports/release/remediation/client-tests.txt`
- [ ] `docs/reports/release/remediation/client-typecheck.txt`
- [ ] `docs/reports/release/remediation/db-architecture.txt`
- [ ] `docs/reports/release/remediation/diff-check.txt`
- [ ] `docs/reports/release/remediation/email-layout-checks.json`
- [ ] `docs/reports/release/remediation/hosted-migration-verification.json`
- [ ] `docs/reports/release/remediation/hosted-public-catalog.txt`
- [ ] `docs/reports/release/remediation/hosted-readiness.txt`
- [ ] `docs/reports/release/remediation/http-smoke.txt`
- [ ] `docs/reports/release/remediation/https-probes.json`
- [ ] `docs/reports/release/remediation/local-rls.txt`
- [ ] `docs/reports/release/remediation/server-dependencies.json`
- [ ] `docs/reports/release/remediation/server-dependency-upgrade.txt`
- [ ] `docs/reports/release/remediation/server-runtime.txt`
- [ ] `docs/reports/release/remediation/server-security-tests.txt`
- [ ] `docs/reports/release/remediation/server-tests.txt`
- [ ] `docs/reports/release/remediation/smtp-probe.txt`
- [ ] `docs/reports/release/remediation/source-change-manifest.json`
- [ ] `docs/reports/release/remediation/stripe-provider.txt`
- [ ] `docs/reports/release/remediation/tls-scan.json`
- [ ] `docs/reports/release/remediation/user-order-cancellation-verification.json`

### storefront — 81 files

- [ ] `docs/reports/storefront/README.md`
- [ ] `docs/reports/storefront/forge-discovery-upgrade-validation.md`
- [ ] `docs/reports/storefront/forge-live-account-validation.md`
- [ ] `docs/reports/storefront/forge-phase2-validation.md`
- [ ] `docs/reports/storefront/forge-phase3-validation.md`
- [ ] `docs/reports/storefront/forge-phase4-validation.md`
- [ ] `docs/reports/storefront/forge-phase5-validation.md`
- [ ] `docs/reports/storefront/forge-redesign-validation.md`
- [ ] `docs/reports/storefront/forge-shared-controls-validation.md`
- [ ] `docs/reports/storefront/lighthouse/README.md`
- [ ] `docs/reports/storefront/lighthouse/forge-discovery-desktop-final.report.html`
- [ ] `docs/reports/storefront/lighthouse/forge-discovery-desktop-final.report.json`
- [ ] `docs/reports/storefront/lighthouse/forge-discovery-mobile-final.report.html`
- [ ] `docs/reports/storefront/lighthouse/forge-discovery-mobile-final.report.json`
- [ ] `docs/reports/storefront/lighthouse/forge-lighthouse-desktop-final.report.html`
- [ ] `docs/reports/storefront/lighthouse/forge-lighthouse-desktop-final.report.json`
- [ ] `docs/reports/storefront/lighthouse/forge-lighthouse-mobile-final.report.html`
- [ ] `docs/reports/storefront/lighthouse/forge-lighthouse-mobile-final.report.json`
- [ ] `docs/reports/storefront/lighthouse/forge-phase2-desktop-final.report.html`
- [ ] `docs/reports/storefront/lighthouse/forge-phase2-desktop-final.report.json`
- [ ] `docs/reports/storefront/lighthouse/forge-phase2-mobile-final.report.html`
- [ ] `docs/reports/storefront/lighthouse/forge-phase2-mobile-final.report.json`
- [ ] `docs/reports/storefront/lighthouse/forge-phase5-home-mobile.metadata.json`
- [ ] `docs/reports/storefront/lighthouse/forge-phase5-home-mobile.report.html`
- [ ] `docs/reports/storefront/lighthouse/forge-phase5-home-mobile.report.json`
- [ ] `docs/reports/storefront/lighthouse/forge-phase5-login-mobile.report.html`
- [ ] `docs/reports/storefront/lighthouse/forge-phase5-login-mobile.report.json`
- [ ] `docs/reports/storefront/screenshots/README.md`
- [ ] `docs/reports/storefront/screenshots/forge-all-dropdowns-account-desktop.png`
- [ ] `docs/reports/storefront/screenshots/forge-all-dropdowns-account-mobile.png`
- [ ] `docs/reports/storefront/screenshots/forge-all-dropdowns-category-desktop.png`
- [ ] `docs/reports/storefront/screenshots/forge-all-dropdowns-filters-mobile.png`
- [ ] `docs/reports/storefront/screenshots/forge-all-dropdowns-final.png`
- [ ] `docs/reports/storefront/screenshots/forge-all-dropdowns-sort-desktop.png`
- [ ] `docs/reports/storefront/screenshots/forge-all-dropdowns-sort-mobile.png`
- [ ] `docs/reports/storefront/screenshots/forge-discovery-catalog.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-discovery-menu.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-discovery-mobile-filters.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-discovery-mobile-product.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-discovery-product.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-discovery-search.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-dropdown-orders-desktop.png`
- [ ] `docs/reports/storefront/screenshots/forge-dropdown-orders-mobile.png`
- [ ] `docs/reports/storefront/screenshots/forge-dropdown-wishlist-mobile.png`
- [ ] `docs/reports/storefront/screenshots/forge-dropdown-wishlist.png`
- [ ] `docs/reports/storefront/screenshots/forge-live-account-payment-mobile.png`
- [ ] `docs/reports/storefront/screenshots/forge-live-account-payment-review.png`
- [ ] `docs/reports/storefront/screenshots/forge-phase2-builder-mobile.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase2-builder.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase2-catalog.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase2-complements.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase2-filters-mobile.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase2-gallery-mobile.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase2-product.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase2-warranty.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-account-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-cart-empty.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-cart-mobile.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-cart.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-checkout-mobile-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-checkout-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-compare-mobile.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-compare.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-orders-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase3-wishlist-mobile.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase4-address-mobile-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase4-addresses-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase4-order-dialog-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase4-order-mobile-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase4-payment-mobile-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase4-payment-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase4-security-mobile-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase4-security-preview.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-phase5-authenticator-mobile.png`
- [ ] `docs/reports/storefront/screenshots/forge-phase5-login-desktop.png`
- [ ] `docs/reports/storefront/screenshots/forge-phase5-login-mobile.png`
- [ ] `docs/reports/storefront/screenshots/forge-phase5-reset-expired-mobile.png`
- [ ] `docs/reports/storefront/screenshots/forge-redesign-catalog.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-redesign-desktop.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-redesign-mobile.jpg`
- [ ] `docs/reports/storefront/screenshots/forge-redesign-product.jpg`

### tooling — 2 files

- [ ] `docs/reports/tooling/README.md`
- [ ] `docs/reports/tooling/forge-phase5-lighthouse.mjs`

## 3. Full scratch QA file inventory

These are the ordinary files inside the selected scratch targets. Directory entries in section 1 include these descendants. The local PostgreSQL data files are intentionally absent.

- [ ] `scratch/checks/admin-auth-live-check.mjs`
- [ ] `scratch/checks/admin-log-live-check.mjs`
- [ ] `scratch/baselines/admin-redesign/next-env.d.ts`
- [ ] `scratch/baselines/admin-redesign/tsconfig.json`
- [ ] `scratch/checks/admin-theme-audit.mjs`
- [ ] `scratch/rewrites/admin-theme-colors.mjs`
- [ ] `scratch/checks/admin-theme-smoke.mjs`
- [ ] `scratch/rewrites/admin-unify-commerce.mjs`
- [ ] `scratch/rewrites/admin-unify-css.mjs`
- [ ] `scratch/checks/admin-universal-audit.mjs`
- [ ] `scratch/harnesses/admin-visual-qa/README.md`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/analytics/inventory/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/analytics/sales/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/coupons/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/dashboard/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/layout.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/logs/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/orders/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/overview/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/products/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/profile/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/reviews/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/admin/users/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/api/[...path]/route.ts`
- [ ] `scratch/harnesses/admin-visual-qa/app/layout.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/page.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/app/preview.css`
- [ ] `scratch/harnesses/admin-visual-qa/fixtures/api-client.ts`
- [ ] `scratch/harnesses/admin-visual-qa/fixtures/auth-client.ts`
- [ ] `scratch/harnesses/admin-visual-qa/fixtures/auth-provider.tsx`
- [ ] `scratch/harnesses/admin-visual-qa/fixtures/auth-store.ts`
- [ ] `scratch/harnesses/admin-visual-qa/fixtures/transport.ts`
- [ ] `scratch/harnesses/admin-visual-qa/next-env.d.ts`
- [ ] `scratch/harnesses/admin-visual-qa/next.config.mjs`
- [ ] `scratch/harnesses/admin-visual-qa/package.json`
- [ ] `scratch/harnesses/admin-visual-qa/postcss.config.mjs`
- [ ] `scratch/harnesses/admin-visual-qa/public/computer-monitor.png`
- [ ] `scratch/harnesses/admin-visual-qa/public/cpu-microprocessor.png`
- [ ] `scratch/harnesses/admin-visual-qa/public/fonts/22a5144ee8d83bca-s.p.woff2`
- [ ] `scratch/harnesses/admin-visual-qa/public/fonts/7d4881bb7e1bf84d-s.p.woff2`
- [ ] `scratch/harnesses/admin-visual-qa/public/forge-icon.svg`
- [ ] `scratch/harnesses/admin-visual-qa/public/graphics-card.jpg`
- [ ] `scratch/harnesses/admin-visual-qa/public/mechanical-keyboard.png`
- [ ] `scratch/harnesses/admin-visual-qa/public/placeholder-user.jpg`
- [ ] `scratch/harnesses/admin-visual-qa/public/placeholder.svg`
- [ ] `scratch/harnesses/admin-visual-qa/public/ram.jpg`
- [ ] `scratch/harnesses/admin-visual-qa/public/solid-state-drive.png`
- [ ] `scratch/harnesses/admin-visual-qa/tsconfig.json`
- [ ] `scratch/baselines/forge-controls-build-baseline.json`
- [ ] `scratch/baselines/forge-dropdown-build-baseline.json`
- [ ] `scratch/baselines/forge-live-auth-build-baseline.json`
- [ ] `scratch/tooling/forge-phase5-audit/audit.mjs`
- [ ] `scratch/tooling/forge-phase5-audit/package.json`
- [ ] `scratch/tooling/forge-phase5-audit/pnpm-lock.yaml`
- [ ] `scratch/rewrites/normalize-operations.mjs`
- [ ] `scratch/checks/payment-navigation-browser.mjs`
- [ ] `scratch/rewrites/theme-commerce.mjs`
- [ ] `scratch/checks/wishlist-browser.mjs`

### Local pnpm cache files

- [ ] `.pnpm-store/v11/index.db`

## 4. Conditional unused source review

A fresh read-only scan inspected 283 client and 155 admin source/config/test/CSS files. It traced static imports, re-exports, literal dynamic imports/require calls and local CSS imports from Next route conventions, declarations, tests, scripts and configuration entry points. There were no unresolved local import paths. The resulting candidates match the earlier 62/46 counts.

**These are review candidates, not established safe deletions.** Computed module references, manual reuse and intended future components can lie outside the static graph. Some files contain prior redesign work; being modified does not prove they are reachable. Remove only in small implementation changes after confirming intended use and running the relevant maintained tests, typechecks and builds. Do not ignore these source files.

### Client — 62 files

- [ ] `client/components/category-card.tsx`
- [ ] `client/components/dropdown-menu.tsx`
- [ ] `client/components/EmailVerificationGuard.tsx`
- [ ] `client/components/patterns/action-bar.tsx`
- [ ] `client/components/product-gallery.tsx`
- [ ] `client/components/ProtectedRoute.tsx`
- [ ] `client/components/route-guard.tsx`
- [ ] `client/components/select.tsx`
- [ ] `client/components/theme-provider.tsx`
- [ ] `client/components/ui/aspect-ratio.tsx`
- [ ] `client/components/ui/avatar.tsx`
- [ ] `client/components/ui/badge.tsx`
- [ ] `client/components/ui/breadcrumb.tsx`
- [ ] `client/components/ui/button-group.tsx`
- [ ] `client/components/ui/calendar.tsx`
- [ ] `client/components/ui/carousel.tsx`
- [ ] `client/components/ui/chart.tsx`
- [ ] `client/components/ui/checkbox.tsx`
- [ ] `client/components/ui/collapsible.tsx`
- [ ] `client/components/ui/command.tsx`
- [ ] `client/components/ui/context-menu.tsx`
- [ ] `client/components/ui/drawer.tsx`
- [ ] `client/components/ui/empty.tsx`
- [ ] `client/components/ui/field.tsx`
- [ ] `client/components/ui/form.tsx`
- [ ] `client/components/ui/hover-card.tsx`
- [ ] `client/components/ui/input-group.tsx`
- [ ] `client/components/ui/input-otp.tsx`
- [ ] `client/components/ui/item.tsx`
- [ ] `client/components/ui/kbd.tsx`
- [ ] `client/components/ui/menubar.tsx`
- [ ] `client/components/ui/navigation-menu.tsx`
- [ ] `client/components/ui/pagination.tsx`
- [ ] `client/components/ui/progress.tsx`
- [ ] `client/components/ui/resizable.tsx`
- [ ] `client/components/ui/scroll-area.tsx`
- [ ] `client/components/ui/separator.tsx`
- [ ] `client/components/ui/sidebar.tsx`
- [ ] `client/components/ui/slider.tsx`
- [ ] `client/components/ui/spinner.tsx`
- [ ] `client/components/ui/switch.tsx`
- [ ] `client/components/ui/table.tsx`
- [ ] `client/components/ui/tabs.tsx`
- [ ] `client/components/ui/toggle-group.tsx`
- [ ] `client/components/ui/toggle.tsx`
- [ ] `client/components/ui/tooltip.tsx`
- [ ] `client/components/ui/use-mobile.tsx`
- [ ] `client/components/ui/use-toast.ts`
- [ ] `client/hooks/api/use-auth.ts`
- [ ] `client/hooks/api/use-orders.ts`
- [ ] `client/hooks/api/use-products.ts`
- [ ] `client/hooks/api/use-user.ts`
- [ ] `client/hooks/use-auth.ts`
- [ ] `client/hooks/use-mobile.ts`
- [ ] `client/hooks/use-orders.ts`
- [ ] `client/hooks/use-products.ts`
- [ ] `client/hooks/use-user.ts`
- [ ] `client/lib/api.ts`
- [ ] `client/lib/schema-validation.ts`
- [ ] `client/lib/toast-utils.ts`
- [ ] `client/services/admin-service.ts`
- [ ] `client/styles/globals.css`

### Admin — 46 files

- [ ] `admin/app/admin/components/error-boundary.tsx`
- [ ] `admin/app/admin/components/loading-skeleton.tsx`
- [ ] `admin/app/admin/components/toast-provider.tsx`
- [ ] `admin/components/ui/accordion.tsx`
- [ ] `admin/components/ui/alert.tsx`
- [ ] `admin/components/ui/aspect-ratio.tsx`
- [ ] `admin/components/ui/avatar.tsx`
- [ ] `admin/components/ui/badge.tsx`
- [ ] `admin/components/ui/breadcrumb.tsx`
- [ ] `admin/components/ui/button-group.tsx`
- [ ] `admin/components/ui/calendar.tsx`
- [ ] `admin/components/ui/carousel.tsx`
- [ ] `admin/components/ui/chart.tsx`
- [ ] `admin/components/ui/checkbox.tsx`
- [ ] `admin/components/ui/collapsible.tsx`
- [ ] `admin/components/ui/context-menu.tsx`
- [ ] `admin/components/ui/drawer.tsx`
- [ ] `admin/components/ui/empty.tsx`
- [ ] `admin/components/ui/field.tsx`
- [ ] `admin/components/ui/form.tsx`
- [ ] `admin/components/ui/hover-card.tsx`
- [ ] `admin/components/ui/input-group.tsx`
- [ ] `admin/components/ui/input-otp.tsx`
- [ ] `admin/components/ui/item.tsx`
- [ ] `admin/components/ui/kbd.tsx`
- [ ] `admin/components/ui/menubar.tsx`
- [ ] `admin/components/ui/navigation-menu.tsx`
- [ ] `admin/components/ui/pagination.tsx`
- [ ] `admin/components/ui/progress.tsx`
- [ ] `admin/components/ui/radio-group.tsx`
- [ ] `admin/components/ui/resizable.tsx`
- [ ] `admin/components/ui/scroll-area.tsx`
- [ ] `admin/components/ui/separator.tsx`
- [ ] `admin/components/ui/sidebar.tsx`
- [ ] `admin/components/ui/slider.tsx`
- [ ] `admin/components/ui/spinner.tsx`
- [ ] `admin/components/ui/switch.tsx`
- [ ] `admin/components/ui/table.tsx`
- [ ] `admin/components/ui/textarea.tsx`
- [ ] `admin/components/ui/toggle-group.tsx`
- [ ] `admin/components/ui/toggle.tsx`
- [ ] `admin/components/ui/tooltip.tsx`
- [ ] `admin/components/ui/use-mobile.tsx`
- [ ] `admin/components/ui/use-toast.ts`
- [ ] `admin/hooks/use-mobile.ts`
- [ ] `admin/styles/globals.css`

Keep the active admin page/action/empty-state patterns, theme provider, command, alert-dialog, popover, sheet and sonner components. These were excluded from the candidate list by current references. An unused chart wrapper does not make direct Recharts usage unused.

### Additional maintenance candidates

- [ ] `server/models/Cart.js` — no runtime import found, but `server/tests/security/leastPrivilege.security.test.js` reads it. Retire only with a deliberate update to that security test's source inventory.
- [ ] `server/models/Game.js` — same security-test dependency; retain the actual product/game tables and routes.
- [ ] `server/models/PrebuiltPc.js` — same security-test dependency; retain the actual prebuilt table and routes.
- [ ] `admin/scripts/schema.sql` — alternate schema; compare with canonical migrations and intended manual use before retiring. Do not delete the canonical migrations.
- [ ] `admin/pnpm-lock.yaml` — contains lockfile settings but no dependency entries; npm is the documented application workflow. Retire only if no pnpm workflow is intended; preserve all npm package-lock files.

Do not automatically uninstall packages from these lists. First retire their consumers, then inspect peers/transitive usage and update the correct manifest and lockfile together.

## 5. Conditional public asset review

The files below have no exact filename reference in the current application/configuration/test/SQL source scan. This is a fresh filename check, **not a database media-usage audit**. Product rows can reference any of these URLs. Check stored image/gallery URLs and intended branding or manual use before deleting. Keep public directories and do not hide static assets with ignore rules.

### Client assets — 23

- [ ] `client/public/cpu-amd-ryzen-7950x.jpg`
- [ ] `client/public/cpu-category.jpg`
- [ ] `client/public/cpu-intel-i7-13700k.jpg`
- [ ] `client/public/cursor-pointer.jpg`
- [ ] `client/public/cursor.jpg`
- [ ] `client/public/elden-ring-cover.jpg`
- [ ] `client/public/gaming-product-image.jpg`
- [ ] `client/public/gpu-amd-7900xtx.jpg`
- [ ] `client/public/gpu-category.jpg`
- [ ] `client/public/gpu-nvidia-rtx-4070.jpg`
- [ ] `client/public/keyboard-razer-viper.jpg`
- [ ] `client/public/modern-tech-product.png`
- [ ] `client/public/peripherals-category.jpg`
- [ ] `client/public/placeholder-logo.png`
- [ ] `client/public/placeholder-logo.svg`
- [ ] `client/public/placeholder-user.jpg`
- [ ] `client/public/placeholder.jpg`
- [ ] `client/public/rtx-4090-side.jpg`
- [ ] `client/public/rtx-4090.jpg`
- [ ] `client/public/ryzen-9-7950x.jpg`
- [ ] `client/public/software-category.jpg`
- [ ] `client/public/ssd-samsung-nvme.jpg`
- [ ] `client/public/windows-11-box.jpg`

### Admin assets — 11

- [ ] `admin/public/computer-monitor.png`
- [ ] `admin/public/cpu-microprocessor.png`
- [ ] `admin/public/graphics-card.jpg`
- [ ] `admin/public/mechanical-keyboard.png`
- [ ] `admin/public/open-briefcase.png`
- [ ] `admin/public/placeholder-logo.png`
- [ ] `admin/public/placeholder-logo.svg`
- [ ] `admin/public/placeholder-user.jpg`
- [ ] `admin/public/placeholder.jpg`
- [ ] `admin/public/ram.jpg`
- [ ] `admin/public/solid-state-drive.png`

`client/public/product-image-large.jpg` is referenced by the conditional `product-gallery.tsx` candidate. Review the image only if that component is retired, and still check database URLs. Keep the active Forge favicons and `admin/public/placeholder.svg`.

## 6. Optional rebuildable output

These are separate cache/build-space options, not application source and not part of the pending QA batch. Stop the exact development/preview process first. Only remove output that is no longer in use; do not treat build-size snapshots as permanent measurements.

- [ ] `client/.next/cache/` — regenerated compiler cache.
- [ ] `admin/.next/cache/` — regenerated compiler cache.
- [ ] `client/.forge-preview/` — optional production-preview build, after its preview stops.
- [ ] `admin/.forge-preview/` — optional production-preview build, after its preview stops.
- [ ] `client/tsconfig.tsbuildinfo` — regenerated TypeScript cache.
- [ ] `admin/tsconfig.tsbuildinfo` — regenerated TypeScript cache.

Do not remove application node_modules as part of this pass; the running/development applications use them.

## 7. Explicitly preserve

- All automated regression/security tests, SQL/RLS fixtures, Vitest configuration and supporting test dependencies.
- `scratch/frontend-audit-postgres/`: existing local PostgreSQL data, not a disposable source helper. It stays local and ignored; removal requires an explicit data-retention decision.
- Recovery backups under `server/backups/`, runtime logs/uploads still needed by the application, and UI/source backup archives whose redundancy has not been established.
- Environment files and credentials locally; never publish them or put their contents in this checklist.
- All application manifests, npm lockfiles, canonical migrations, active application code and used media.
- `server/scripts/catalog/seed-demo-catalog.js`, `server/scripts/catalog/data/demo-catalog.js`, `server/scripts/docs/generate-route-map.js`, `server/scripts/checks/enforce-db-architecture.js`, `server/scripts/tests/run-rls-tests.js` and their maintained [script guide](server/scripts/README.md).
- Current [setup documentation](README.md), [API/architecture references](docs/README.md), design-system/component guides, this checklist and [.gitignore](.gitignore).
- Existing unrelated working-tree changes. Do not reset, revert, force-untrack or commit them as a shortcut.

## 8. Public repository policy and execution order

Keep source, maintained tests, setup/migrations, npm lockfiles and current documentation public. Ignore dependencies, builds/caches, generated test output, secrets, runtime/recovery data and local tool bundles. The whole scratch workspace and report-output area are ignored, with no exceptions for final reports or machine-specific browser scripts. Keep GitHub workflows visible. An ignore rule does not delete files or erase tracked history.

1. Review the exact pending QA scope in sections 1–3, including historical reports and cache state.
2. Stop any exact QA/build process using a selected target. Resolve each target and normal parent inside the intended workspace.
3. Unlink junction entries without enumerating their targets; then remove only selected ordinary files and emptied folders. Preserve the data directory and application dependencies.
4. Check current documentation and package commands for references to retired files. Update the status here only after actual execution.
5. Handle conditional source/assets/dependencies in separate reviewed changes. Run maintained checks; do not create a new QA archive or deletion manifest.

Useful read-only Git checks:

```powershell
git status --short
git ls-files -ci --exclude-standard
git check-ignore -v --no-index scratch/example.txt docs/reports/example.json server/.env
```
