# Backend tests

These are maintained automated regression tests. The owner's cleanup policy preserves them; one-off browser/live-account probes belong outside this suite.

| Folder | Coverage |
| --- | --- |
| `admin/` | Admin response contracts and analytics completeness. |
| `cart/` | Cart totals and wishlist behavior. |
| `catalog/` | Prices and specification facets. |
| `email/` | Email templates and transport. |
| `logs/` | Log reader and controller behavior. |
| `orders/` | Creation, history and allowed transitions. |
| `payments/` | Disabled flows, metadata, webhooks and Stripe sessions. |
| `reviews/` | Customer review behavior. |
| `users/` | Address validation. |
| `security/` | Authentication/database identity, checkout, privilege boundaries, public catalog and route exposure. |
| `helpers/` | Shared isolated test environment and loopback HTTP setup. |
| `integration/rls/` | SQL assertions for storefront privacy, checkout, analytics and cancellation. |

From the repository root:

```powershell
npm --prefix server test
npm --prefix server run test:watch
npm --prefix server run test:security
npm --prefix server test -- tests/orders/orderHistory.test.js
```

The security command retains its existing three-file scope: route surface, least privilege and public catalog. Run the whole `tests/security/` directory or the full suite for the other security cases.

Vitest loads `helpers/setup.js`, which replaces external-provider credentials with isolated test values. The HTTP helper uses loopback servers. These tests do not require the developer's real Supabase, payment or SMTP credentials.

The separate `npm --prefix server run test:rls` command uses a dedicated local PostgreSQL instance and the [maintained runner](../scripts/tests/run-rls-tests.js). It creates and drops a temporary database and applies canonical migrations plus these SQL assertions. The runner can create cluster-wide roles, so use a dedicated test cluster rather than a shared application cluster. Setup and overrides are in the [root README](../../README.md#real-postgresqlrls-integration).

Keep tests with their feature area, shared environment/network helpers under `helpers/`, and SQL fixtures under `integration/rls/`. Do not save test-run logs, screenshot archives or QA manifests here.
