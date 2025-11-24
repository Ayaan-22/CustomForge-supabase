# CustomForge – Customer UI with Mock API

This app ships a full customer-facing UI and a lightweight in-app backend under `/api/v1` that mirrors your MERN endpoints. Until your backend is hosted, the UI talks to these mock endpoints and persists session state via httpOnly cookies.

## Architecture

- app/api/v1 – Mock backend mirroring the provided API spec (auth, users, products, cart, orders, payment)
- mock/ – Canonical mock JSON (no duplication). All routes import from here.
- services/ – Client wrappers (map 1:1 to API endpoints)
- components/, hooks/, lib/ – Modular UI, state, and shared utilities

## Switching to real backend

- Set `NEXT_PUBLIC_API_BASE_URL` in Vars to your server URL. `lib/apiClient.ts` falls back to `/api/v1` if not set.
- Keep the same endpoint paths on your server; the services will work unchanged.

## Notes

- Auth is cookie-based (`cf_*` cookies) in mock mode.
- 2FA code is `123456` in mock.
- Coupons: `SAVE10`, `LAUNCH15`.
- Example flows covered: health, products (list/detail/search/category), wishlist, cart (+coupon), orders (create/list/detail/cancel/return), payment (intent/process/methods).

## Deliverables Checklist

- Health: GET /api/v1/health
- Auth: register, login, logout, verify, forgot/reset, update-password, 2FA enable/verify/disable
- Users: me, update-me, delete-me, wishlist, orders
- Products: list/top/search/categories/featured/category/:category/:id/related, reviews (POST)
- Wishlist: get, add/remove (auth)
- Cart: get/add/clear/update-item/remove-item/coupon add/remove
- Orders: create/list/get/payment-status/cancel/return
- Payment: webhook, process, create-intent, payment-methods get/add

All implemented against centralized mock data and session cookies.
