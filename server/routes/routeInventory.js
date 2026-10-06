/**
 * Canonical API surface for CustomForge (auditable source of truth).
 * Paths are absolute. Aliases must stay listed so they are not treated as accidental public.
 */

export const PUBLIC_ROUTES = [
  { method: "GET", path: "/api/v1/health", owner: "app" },
  { method: "GET", path: "/api/v1/auth/csrf-token", owner: "auth" },
  { method: "GET", path: "/api/v1/auth/verify-email/:token", owner: "auth" },
  { method: "POST", path: "/api/v1/auth/register", owner: "auth" },
  { method: "POST", path: "/api/v1/auth/login", owner: "auth" },
  { method: 'POST', path: '/api/v1/auth/resend-verification', owner: 'auth', note: 'Email/password proof; CSRF; IP + account throttling; sends email only, no session issued' },
  { method: "POST", path: "/api/v1/auth/logout", owner: "auth" },
  { method: "POST", path: "/api/v1/auth/forgot-password", owner: "auth" },
  { method: "POST", path: "/api/v1/auth/reset-password/:token", owner: "auth" },
  { method: "POST", path: "/api/v1/auth/refresh", owner: "auth" },
  {
    method: "GET",
    path: "/api/v1/users/me",
    owner: "users",
    note: "optionalAuth; data is null when anonymous",
  },
  { method: "GET", path: "/api/v1/products", owner: "products" },
  { method: "GET", path: "/api/v1/products/top", owner: "products" },
  { method: "GET", path: "/api/v1/products/search", owner: "products" },
  { method: "GET", path: "/api/v1/products/categories", owner: "products" },
  { method: "GET", path: "/api/v1/products/brands", owner: "products" },
  { method: "GET", path: "/api/v1/products/facets", owner: "products", note: "Bounded public specification metadata; exact counts exclude brand/spec selections" },
  { method: "GET", path: "/api/v1/products/featured", owner: "products" },
  { method: "GET", path: "/api/v1/products/category/:category", owner: "products" },
  { method: "GET", path: "/api/v1/products/:id", owner: "products" },
  { method: "GET", path: "/api/v1/products/:id/related", owner: "products" },
  {
    method: "GET",
    path: "/api/v1/products/:id/reviews",
    owner: "products",
    canonical: true,
  },
  {
    method: "GET",
    path: "/api/v1/reviews/products/:id/reviews",
    owner: "reviews",
    deprecated: true,
    aliasOf: "GET /api/v1/products/:id/reviews",
  },
  {
    method: "POST",
    path: "/api/v1/payment/webhook",
    owner: "app",
    note: "Stripe signature; isolated from JSON parser, CSRF, and JWT",
  },
];

export const PROTECTED_ROUTES = [
  {
    method: "POST",
    path: "/api/v1/auth/send-verification-email",
    owner: "auth",
    middleware: ["protect"],
  },
  {
    method: "PATCH",
    path: "/api/v1/auth/update-password",
    owner: "auth",
    middleware: ["protect", "verifiedEmail", "twoFactorAuth"],
  },
  {
    method: "POST",
    path: "/api/v1/auth/2fa/enable",
    owner: "auth",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "POST",
    path: "/api/v1/auth/2fa/verify",
    owner: "auth",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "DELETE",
    path: "/api/v1/auth/2fa/disable",
    owner: "auth",
    middleware: ["protect", "verifiedEmail", "twoFactorAuth"],
  },
  {
    method: "GET",
    path: "/api/v1/users/profile",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "PATCH",
    path: "/api/v1/users/profile",
    owner: "users",
    middleware: ["protect", "verifiedEmail", "twoFactorAuth"],
  },
  {
    method: "PATCH",
    path: "/api/v1/users/update-me",
    owner: "users",
    middleware: ["protect", "verifiedEmail", "twoFactorAuth"],
    aliasOf: "PATCH /api/v1/users/profile",
  },
  {
    method: "PATCH",
    path: "/api/v1/users/change-password",
    owner: "users",
    middleware: ["protect", "verifiedEmail", "twoFactorAuth"],
    aliasOf: "PATCH /api/v1/auth/update-password",
    note: "Legacy response does not issue a new token pair; preserved for compatibility.",
  },
  {
    method: "DELETE",
    path: "/api/v1/users/delete-account",
    owner: "users",
    middleware: ["protect", "verifiedEmail", "twoFactorAuth"],
  },
  {
    method: "DELETE",
    path: "/api/v1/users/delete-me",
    owner: "users",
    middleware: ["protect", "verifiedEmail", "twoFactorAuth"],
    aliasOf: "DELETE /api/v1/users/delete-account",
  },
  {
    method: "GET",
    path: "/api/v1/users/wishlist",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
    canonical: true,
  },
  {
    method: "POST",
    path: "/api/v1/users/wishlist/:productId",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
    canonical: true,
  },
  {
    method: "DELETE",
    path: "/api/v1/users/wishlist/:productId",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
    canonical: true,
  },
  {
    method: "GET",
    path: "/api/v1/users/orders",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
    aliasOf: "GET /api/v1/orders",
    note: "Legacy pagination and response envelope retained.",
  },
  {
    method: "GET",
    path: "/api/v1/users/my-orders",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
    aliasOf: "GET /api/v1/orders",
  },
  {
    method: "GET",
    path: "/api/v1/users/addresses",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "POST",
    path: "/api/v1/users/addresses",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "PATCH",
    path: "/api/v1/users/addresses/:id",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "PATCH",
    path: "/api/v1/users/addresses/:id/default",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "DELETE",
    path: "/api/v1/users/addresses/:id",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "GET",
    path: "/api/v1/users/payment-methods",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "POST",
    path: "/api/v1/users/payment-methods",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "PATCH",
    path: "/api/v1/users/payment-methods/:id",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "PATCH",
    path: "/api/v1/users/payment-methods/:id/default",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "DELETE",
    path: "/api/v1/users/payment-methods/:id",
    owner: "users",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "POST",
    path: "/api/v1/products/:id/reviews",
    owner: "products",
    middleware: ["protect", "verifiedEmail", "restrictTo"],
  },
  {
    method: "POST",
    path: "/api/v1/products/:id/wishlist",
    owner: "products",
    middleware: ["protect", "verifiedEmail", "restrictTo"],
    aliasOf: "POST /api/v1/users/wishlist/:productId",
  },
  {
    method: "DELETE",
    path: "/api/v1/products/:id/wishlist",
    owner: "products",
    middleware: ["protect", "verifiedEmail", "restrictTo"],
    aliasOf: "DELETE /api/v1/users/wishlist/:productId",
  },
  {
    method: "GET",
    path: "/api/v1/reviews/products/:id/mine",
    owner: "reviews",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "PATCH",
    path: "/api/v1/reviews/:reviewId",
    owner: "reviews",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "DELETE",
    path: "/api/v1/reviews/:reviewId",
    owner: "reviews",
    middleware: ["protect", "verifiedEmail"],
  },
  { method: "GET", path: "/api/v1/cart", owner: "cart", middleware: ["protect", "verifiedEmail"] },
  { method: "POST", path: "/api/v1/cart/add", owner: "cart", middleware: ["protect", "verifiedEmail"] },
  { method: "DELETE", path: "/api/v1/cart", owner: "cart", middleware: ["protect", "verifiedEmail"] },
  { method: "POST", path: "/api/v1/cart/coupon", owner: "cart", middleware: ["protect", "verifiedEmail"] },
  { method: "DELETE", path: "/api/v1/cart/coupon", owner: "cart", middleware: ["protect", "verifiedEmail"] },
  { method: "PATCH", path: "/api/v1/cart/update", owner: "cart", middleware: ["protect", "verifiedEmail"] },
  { method: "DELETE", path: "/api/v1/cart/remove/:id", owner: "cart", middleware: ["protect", "verifiedEmail"] },
  { method: "GET", path: "/api/v1/orders", owner: "orders", middleware: ["protect", "verifiedEmail"] },
  { method: "POST", path: "/api/v1/orders", owner: "orders", middleware: ["protect", "verifiedEmail"], note: "Stable idempotencyKey required; PayPal unavailable before inventory reservation." },
  { method: "POST", path: "/api/v1/orders/cancel/:id", owner: "orders", middleware: ["protect", "verifiedEmail"], note: "Owner-only atomic cancellation for pending unpaid COD; requires cancel_unpaid_order migration." },
  {
    method: "POST",
    path: "/api/v1/orders/request-return/:id",
    owner: "orders",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "GET",
    path: "/api/v1/orders/:id/payment-status",
    owner: "orders",
    middleware: ["protect", "verifiedEmail"],
  },
  { method: "GET", path: "/api/v1/orders/:id", owner: "orders", middleware: ["protect", "verifiedEmail"] },
  {
    method: "POST",
    path: "/api/v1/payment/process",
    note: "Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available.",
    owner: "payment",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "POST",
    path: "/api/v1/payment/create-intent",
    note: "Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available.",
    owner: "payment",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "POST",
    path: "/api/v1/payment/create-stripe-session",
    owner: "payment",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "POST",
    path: "/api/v1/payment/create-order-cod",
    note: "Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available.",
    owner: "payment",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "POST",
    path: "/api/v1/payment/paypal/create-order",
    note: "Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available.",
    owner: "payment",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "POST",
    path: "/api/v1/payment/paypal/capture-order",
    note: "Compatibility endpoint; authenticated and CSRF-protected, returns 503 until a verified workflow is available.",
    owner: "payment",
    middleware: ["protect", "verifiedEmail"],
  },
  {
    method: "GET",
    path: "/api/v1/payment/payment-methods",
    owner: "payment",
    middleware: ["protect", "verifiedEmail"],
    note: "Stripe stored cards; distinct from /users/payment-methods",
  },
  {
    method: "POST",
    path: "/api/v1/payment/payment-methods",
    note: "Enrollment disabled (503); requires provider-verified setup and consent.",
    owner: "payment",
    middleware: ["protect", "verifiedEmail"],
  },
];

// Explicit method/path pairs: a new admin route must be reviewed and inventoried.
export const ADMIN_ROUTES = [
  ["GET", "/analytics/overview"],
  ["GET", "/analytics/sales"],
  ["GET", "/analytics/users"],
  ["GET", "/analytics/orders"],
  ["GET", "/analytics/products"],
  ["GET", "/analytics/inventory"],
  ["POST", "/users"], ["GET", "/users"],
  ["GET", "/users/:id"], ["PATCH", "/users/:id"], ["DELETE", "/users/:id"],
  ["GET", "/products"], ["POST", "/products"],
  ["PATCH", "/products/:id"], ["DELETE", "/products/:id"],
  ["PATCH", "/products/:id/toggle-active"],
  ["PATCH", "/products/:id/feature"], ["PATCH", "/products/:id/stock"],
  ["GET", "/products/:id/reviews"],
  ["DELETE", "/products/:id/reviews", "DELETE /api/v1/admin/reviews/:id",
    "Legacy id means REVIEW id, not product id; never bulk-deletes product reviews."],
  ["GET", "/orders"], ["GET", "/orders/:id"],
  ["PATCH", "/orders/:id/update-status"], ["PATCH", "/orders/:id/mark-paid"],
  ["PATCH", "/orders/:id/mark-delivered"], ["PATCH", "/orders/:id/refund"],
  ["PATCH", "/orders/:id/approve-return"],
  ["POST", "/orders/:id/refund", "PATCH /api/v1/admin/orders/:id/refund"],
  ["PUT", "/orders/:id/process-return"],
  ["POST", "/coupons"], ["GET", "/coupons"],
  ["GET", "/coupons/:id"], ["PATCH", "/coupons/:id"], ["DELETE", "/coupons/:id"],
  ["PATCH", "/coupons/:id/toggle"],
  ["GET", "/reviews"], ["PATCH", "/reviews/:id/moderate"], ["DELETE", "/reviews/:id"],
  ["GET", "/logs"], ["GET", "/logs/dates/available"], ["GET", "/logs/stats"],
  ["GET", "/logs/errors"], ["GET", "/logs/access"], ["GET", "/logs/:id"],
].map(([method, path, aliasOf, note]) => ({
  method, path: `/api/v1/admin${path}`, owner: "admin",
  middleware: ["protect", "restrictTo:admin", "verifiedEmail", "twoFactorAuth"],
  ...(aliasOf ? { aliasOf, deprecated: true } : {}), ...(note ? { note } : {}),
}));

export const DEV_ONLY_ROUTES = [
  "send-welcome", "send-password-reset", "send-order-confirmation", "send-verification",
].map((path) => ({
  method: "POST", path: `/api/v1/email/${path}`, owner: "email-test",
  middleware: ["rejectInProduction", "protect", "restrictTo:admin", "verifiedEmail", "twoFactorAuth"],
  note: "Development only, or test with ENABLE_DEV_ROUTES=true. Never mounted in production/staging/unknown environments.",
}));

for (const route of [...PUBLIC_ROUTES, ...PROTECTED_ROUTES]) {
  if (route.aliasOf) route.deprecated = true;
}

export const ALL_ROUTES = [...PUBLIC_ROUTES, ...PROTECTED_ROUTES, ...ADMIN_ROUTES, ...DEV_ONLY_ROUTES];

export const CANONICAL_OWNERS = {
  session: "GET /api/v1/users/me",
  auth: "/api/v1/auth",
  catalog: "/api/v1/products",
  productReviewsRead: "GET /api/v1/products/:id/reviews",
  productReviewsWrite: "POST /api/v1/products/:id/reviews",
  reviewMutations: "/api/v1/reviews/:reviewId",
  wishlist: "/api/v1/users/wishlist",
  cart: "/api/v1/cart",
  userOrdersList: "GET /api/v1/orders",
  passwordChanges: "PATCH /api/v1/auth/update-password",
  orders: "/api/v1/orders",
  userPaymentMethods: "/api/v1/users/payment-methods",
  stripePaymentMethods: "/api/v1/payment/payment-methods",
  payments: "/api/v1/payment",
  stripeWebhook: "POST /api/v1/payment/webhook",
  admin: "/api/v1/admin",
};

export const ROUTE_MOUNTS = {
  auth: "/api/v1/auth",
  admin: "/api/v1/admin",
  products: "/api/v1/products",
  users: "/api/v1/users",
  cart: "/api/v1/cart",
  orders: "/api/v1/orders",
  payment: "/api/v1/payment",
  reviews: "/api/v1/reviews",
};

export function joinMount(mount, routePath) {
  if (!routePath || routePath === "/") return mount;
  return `${mount}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

export function routeKey(method, path) {
  return `${String(method).toUpperCase()} ${path}`;
}

export function cataloguedRouteKeys() {
  const keys = new Set();
  for (const route of ALL_ROUTES) {
    keys.add(routeKey(route.method, route.path));
  }
  return keys;
}

/** Product static segments that must be registered before `/:id`. */
export const PRODUCT_STATIC_SEGMENTS = [
  "top",
  "search",
  "categories",
  "featured",
  "category",
];

export const ORDER_STATIC_PREFIXES = ["cancel", "request-return"];

export function listRouterRoutes(router) {
  return router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => {
      const methods = Object.keys(layer.route.methods).filter(
        (method) => layer.route.methods[method] && method !== "_all"
      );
      return methods.map((method) => ({
        method: method.toUpperCase(),
        path: layer.route.path,
      }));
    });
}
