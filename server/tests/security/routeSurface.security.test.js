import {listenForFetch} from "../helpers/listenForFetch.js";
import http from "node:http";
import express from "express";
import Stripe from "stripe";
import speakeasy from "speakeasy";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Real Express, JWT, role/email/2FA, CSRF, validation and rate limiting.
// Stub business handlers: never send mail, charge cards, or accept a DB 500 as success.
const fixtures = vi.hoisted(() => ({
  users: {},
  stub: (module, keep = []) => Object.fromEntries(Object.entries(module).map(([name, handler]) => [
    name, typeof handler === "function" && !keep.includes(name)
      ? (req, res) => res.json({ handler: name, params: req.params }) : handler,
  ])),
}));
vi.mock("../../config/db.js", () => {
  const db = { from: (table) => {
    if (table === "user_wishlist") return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    throw new Error("Unexpected database access in route test");
  } };
  return { getSupabaseClient: () => db, getAuthClient: () => db, bindDatabaseIdentity: () => {}, getServiceClient: () => db, getAnonClient: () => db };
});
vi.mock("../../middleware/logger.js", () => {
  const logger = Object.fromEntries(["info", "warn", "error", "debug"].map((name) => [name, vi.fn()]));
  const pass = (_req, _res, next) => next();
  return { logger, default: logger, requestLogger: pass, performanceLogger: pass,
    requestIdMiddleware: pass, errorLogger: (err, _req, _res, next) => next(err) };
});
vi.mock("../../models/User.js", async (original) => ({
  ...await original(), findUserById: vi.fn(async (id) => fixtures.users[id]),
}));
vi.mock("../../controllers/authController.js", async (original) =>
  fixtures.stub(await original(), ["loginLimiter", "csrfToken", "enableTwoFactor"]));
vi.mock("../../controllers/userController.js", async (original) => fixtures.stub(await original(), ["getMe"]));
vi.mock("../../controllers/productController.js", async (original) => fixtures.stub(await original()));
vi.mock("../../controllers/reviewController.js", async (original) => fixtures.stub(await original()));
vi.mock("../../controllers/orderController.js", async (original) => fixtures.stub(await original()));
vi.mock("../../controllers/cartController.js", async (original) => fixtures.stub(await original()));
vi.mock("../../controllers/adminController.js", async (original) => fixtures.stub(await original()));
vi.mock("../../controllers/logController.js", async (original) => fixtures.stub(await original()));
vi.mock("../../controllers/paymentController.js", async (original) => fixtures.stub(await original(), ["handleWebhook"]));

import { createApp } from "../../app.js";
import authRoutes from "../../routes/authRoutes.js";
import productRoutes from "../../routes/productRoutes.js";
import userRoutes from "../../routes/userRoutes.js";
import cartRoutes from "../../routes/cartRoutes.js";
import orderRoutes from "../../routes/orderRoutes.js";
import paymentRoutes from "../../routes/paymentRoutes.js";
import reviewRoutes from "../../routes/reviewRoutes.js";
import adminRoutes from "../../routes/adminRoutes.js";
import emailRoutes from "../../routes/emailTestRoutes.js";
import { ALL_ROUTES, PUBLIC_ROUTES, PROTECTED_ROUTES, ADMIN_ROUTES, DEV_ONLY_ROUTES,
  ROUTE_MOUNTS, joinMount, listRouterRoutes, routeKey } from "../../routes/routeInventory.js";
import { isDevRouteEnv } from "../../middleware/devOnly.js";
import { signToken } from "../../utils/generateToken.js";
import { buildCsrfToken } from "../../utils/csrf.js";
import { sensitiveAuthLimiter, webhookLimiter, verificationAccountLimiter } from "../../config/rateLimit.js";
import { createHash } from 'node:crypto';
import { publicUser } from "../../utils/publicUser.js";
import { authActionUrl } from "../../utils/authActionUrl.js";

const routers = { auth: authRoutes, products: productRoutes, users: userRoutes,
  cart: cartRoutes, orders: orderRoutes, payment: paymentRoutes, reviews: reviewRoutes, admin: adminRoutes };
const id = "00000000-0000-4000-8000-000000000001";
const concrete = (path) => path.replace(/:[A-Za-z]+/g, id);
const key = ({ method, path }) => routeKey(method, path);
const csrf = buildCsrfToken("anon:route-tests");
const validBody = { name: "Route Tester", email: "route@example.test", password: "TestPassword123!", passwordConfirm: "TestPassword123!" };
const servers = [];
let base;
let app;
const listen = async (application) => {
  const server = http.createServer(application);
  await listenForFetch(server);
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
};
const request = (route, { user, origin = base, body = validBody, withCsrf = true, headers = {} } = {}) => {
  const safe = ["GET", "HEAD"].includes(route.method);
  return fetch(`${origin}${concrete(route.path)}`, {
    method: route.method,
    headers: {
      ...(user ? { Authorization: `Bearer ${signToken(user)}` } : {}),
      ...(!safe ? { "Content-Type": "application/json" } : {}),
      ...(withCsrf ? { Cookie: `anon_session=route-tests; csrf_token=${csrf}`, "X-CSRF-Token": csrf } : {}),
      ...headers,
    },
    ...(!safe ? { body: JSON.stringify(body) } : {}),
  });
};

beforeAll(async () => {
  for (const [name, values] of Object.entries({
    user: {}, unverified: { isEmailVerified: false }, admin: { role: "admin" },
    disabled: { active: false }, twofactor: { role: "admin", twoFactorEnabled: true, twoFactorSecret: "JBSWY3DPEHPK3PXP" },
    missingsecret: { role: "admin", twoFactorEnabled: true },
  })) fixtures.users[name] = { id: name, role: "user", active: true, isEmailVerified: true, ...values };
  app = createApp();
  base = await listen(app);
});
afterEach(() => {
  verificationAccountLimiter.resetKey(createHash('sha256').update(validBody.email).digest('hex'));
  vi.unstubAllEnvs();
  for (const limiter of [sensitiveAuthLimiter, webhookLimiter]) {
    limiter.resetKey("127.0.0.1");
    limiter.resetKey("ip:127.0.0.1");
  }
});
afterAll(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  })));
});

describe("complete exposure inventory", () => {
  it("exactly matches every router and application endpoint, including admin and dev", () => {
    const mounted = Object.entries(routers).flatMap(([name, router]) =>
      listRouterRoutes(router).map((route) => ({ ...route, path: joinMount(ROUTE_MOUNTS[name], route.path) })));
    const direct = app._router.stack.filter((layer) => layer.route && layer.route.path !== "*")
      .flatMap((layer) => Object.keys(layer.route.methods).map((method) => ({ method, path: layer.route.path })));
    const dev = listRouterRoutes(emailRoutes).map((route) => ({ ...route, path: joinMount("/api/v1/email", route.path) }));
    expect([...mounted, ...direct, ...dev].map(key).sort()).toEqual(ALL_ROUTES.map(key).sort());
    expect(new Set(ALL_ROUTES.map(key)).size).toBe(ALL_ROUTES.length);
    const mounts = app._router.stack.filter((layer) => layer.handle.stack);
    expect(mounts.map((layer) => layer.handle)).toEqual(expect.arrayContaining(Object.values(routers)));
    expect(mounts).toHaveLength(Object.keys(routers).length);
    for (const [name, router] of Object.entries(routers)) {
      expect(mounts.find((entry) => entry.handle === router).regexp.test(ROUTE_MOUNTS[name])).toBe(true);
    }
  });
  it("has a direct canonical target for every deprecated alias", () => {
    for (const route of ALL_ROUTES.filter((route) => route.aliasOf)) {
      expect(route.deprecated, key(route)).toBe(true);
      const canonical = ALL_ROUTES.find((candidate) => key(candidate) === route.aliasOf);
      expect(canonical, key(route)).toBeDefined();
      expect(canonical.aliasOf).toBeUndefined();
    }
  });
  it("has no duplicate or shadowed route for the same method on any router", () => {
    for (const router of [...Object.values(routers), emailRoutes]) {
      const layers = router.stack.filter((layer) => layer.route);
      for (let index = 0; index < layers.length; index++) {
        const current = layers[index];
        expect(current.route.path).not.toMatch(/\*/);
        for (const previous of layers.slice(0, index)) {
          const sameMethod = Object.keys(current.route.methods).some((method) => previous.route.methods[method]);
          if (sameMethod) expect(previous.regexp.test(concrete(current.route.path)), current.route.path).toBe(false);
        }
      }
    }
    expect(app._router.stack.filter((layer) => layer.route).at(-1).route.path).toBe("*");
  });
});

describe("authentication intent through HTTP with valid CSRF", () => {
  it.each([...PROTECTED_ROUTES, ...ADMIN_ROUTES])("rejects anonymous $method $path", async (route) => {
    expect((await request(route)).status).toBe(401);
  });
  it.each(PROTECTED_ROUTES.filter((route) => route.middleware.includes("verifiedEmail")))
    ("rejects unverified $method $path", async (route) => {
      expect((await request(route, { user: "unverified" })).status).toBe(403);
    });
  it.each(ADMIN_ROUTES)("rejects non-admin $method $path", async (route) => {
    expect((await request(route, { user: "user" })).status).toBe(403);
  });
  it.each(ADMIN_ROUTES)("allows admin dispatch $method $path", async (route) => {
    expect((await request(route, { user: "admin" })).status).toBe(200);
  });
  it("lets an unverified account request verification", async () => {
    const res = await request({ method: "POST", path: "/api/v1/auth/send-verification-email" }, { user: "unverified" });
    expect(res.status).toBe(200);
    expect((await res.json()).handler).toBe("sendVerificationEmail");
  });
  it("rejects invalid credentials and disabled accounts", async () => {
    const route = { method: "GET", path: "/api/v1/cart" };
    expect((await request(route, { headers: { Authorization: "Bearer invalid" } })).status).toBe(401);
    expect((await request(route, { user: "disabled" })).status).toBe(403);
  });
  it("requires enabled 2FA and fails closed if its secret is missing", async () => {
    const route = { method: "GET", path: "/api/v1/admin/users" };
    expect((await request(route, { user: "twofactor" })).status).toBe(401);
    expect((await request(route, { user: "missingsecret" })).status).toBe(403);
    const token = speakeasy.totp({ secret: fixtures.users.twofactor.twoFactorSecret, encoding: "base32" });
    expect((await request(route, { user: "twofactor", headers: { "X-2FA-Token": token } })).status).toBe(200);
    // Existing frontend disable flow sends { password, token } in the JSON body.
    expect((await request({ method: "DELETE", path: "/api/v1/auth/2fa/disable" },
      { user: "twofactor", body: { password: "TestPassword123!", token } })).status).toBe(200);
  });
  it("cannot disable existing 2FA by restarting enrollment", async () => {
    expect((await request({ method: "POST", path: "/api/v1/auth/2fa/enable" }, { user: "twofactor" })).status).toBe(409);
  });
});

describe("public operations and route selection", () => {
  it("uses configured frontend auth forms for emailed tokens", () => {
    vi.stubEnv("CLIENT_URL", "https://store.example.test");
    expect(authActionUrl("verify-email", "test/token")).toBe("https://store.example.test/verify-email/test%2Ftoken");
    expect(authActionUrl("reset-password", "reset-token")).toBe("https://store.example.test/reset-password/reset-token");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLIENT_URL", "");
    expect(() => authActionUrl("reset-password", "token")).toThrow(/CLIENT_URL/);
  });
  it("does not serialize identity secrets into session or profile responses", async () => {
    const secrets = { password: "hash", twoFactorSecret: "secret", emailVerificationToken: "verify",
      emailVerificationExpires: "date", passwordResetToken: "reset", passwordResetExpires: "date",
      refreshTokenHash: "refresh", refreshTokenExpires: "date" };
    fixtures.users.sensitive = { ...fixtures.users.user, id: "sensitive", ...secrets };
    expect(publicUser(fixtures.users.sensitive)).toEqual({ ...fixtures.users.user, id: "sensitive" });
    for (const path of ["/api/v1/users/me", "/api/v1/users/profile"]) {
      const res = await request({ method: "GET", path }, { user: "sensitive" });
      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.id).toBe("sensitive");
      for (const field of Object.keys(secrets)) expect(data).not.toHaveProperty(field);
    }
  });
  it.each(PUBLIC_ROUTES.filter((route) => !route.path.endsWith("/webhook")))
    ("keeps $method $path accessible", async (route) => {
      const res = await request(route);
      expect(res.status).toBe(200);
      if (route.path === "/api/v1/users/me") expect(await res.json()).toEqual({ success: true, data: null });
    });
  it.each([
    ["/products/search", "searchProducts"], ["/products/top", "getTopProducts"],
    ["/products/featured", "getFeaturedProducts"], ["/products/categories", "getCategories"],
    ["/products/category/components", "getProductsByCategory"],
    [`/products/${id}/reviews`, "getProductReviews"], [`/products/${id}/related`, "getRelatedProducts"],
    [`/products/${id}`, "getProduct"], [`/reviews/products/${id}/reviews`, "getProductReviews"],
    ["/admin/logs/stats", "getLogStats"], ["/admin/logs/dates/available", "getAvailableLogDates"],
    ["/admin/logs/errors", "getAllLogs"], ["/admin/logs/access", "getAllLogs"],
    [`/admin/logs/${id}`, "getLogById"], [`/orders/${id}/payment-status`, "getPaymentStatus"],
  ])("dispatches %s to %s", async (path, handler) => {
    const res = await request({ method: "GET", path: `/api/v1${path}` }, { user: "admin" });
    expect(res.status).toBe(200);
    expect((await res.json()).handler).toBe(handler);
  });
  it.each(ALL_ROUTES.filter((route) => route.aliasOf))("deprecates $method $path without redirecting", async (route) => {
    const res = await request(route, { user: "admin" });
    expect(res.status).toBe(200);
    expect(res.headers.get("deprecation")).toBe("true");
    expect(res.headers.get("link")).toBe(`<${concrete(route.aliasOf.split(" ")[1])}>; rel="successor-version"`);
  });
  it("rejects public mutations without CSRF", async () => {
    const res = await request({ method: "POST", path: "/api/v1/auth/register" }, { withCsrf: false });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/CSRF/);
  });
  it("supports HEAD catalog reads", async () => {
    expect((await request({ method: "HEAD", path: "/api/v1/products/search" })).status).toBe(200);
  });
});

describe("development routes", () => {
  it.each(["production", "staging", "prod", "unknown", ""])("never mounts utilities in %s even with opt-in", async (env) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("ENABLE_DEV_ROUTES", "true");
    expect(isDevRouteEnv()).toBe(false);
    const production = createApp();
    expect(production._router.stack.some((layer) => layer.handle === emailRoutes)).toBe(false);
    const origin = await listen(production);
    for (const route of DEV_ONLY_ROUTES) expect((await request(route, { origin })).status).toBe(404);
  });
  it("requires admin even when enabled locally", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const origin = await listen(createApp());
    for (const route of DEV_ONLY_ROUTES) {
      expect((await request(route, { origin })).status).toBe(401);
      expect((await request(route, { origin, user: "user" })).status).toBe(403);
      expect((await request(route, { origin, user: "admin", body: {} })).status).toBe(400);
    }
  });
  it("returns 404 even if accidentally mounted in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const isolated = express();
    isolated.use("/api/v1/email", emailRoutes);
    const origin = await listen(isolated);
    for (const route of DEV_ONLY_ROUTES) expect((await request(route, { origin })).status).toBe(404);
  });
});

describe("abuse controls and webhook isolation", () => {
  it('requires CSRF for signed-out verification recovery', async () => {
    expect((await request({method:'POST',path:'/api/v1/auth/resend-verification'}, {withCsrf:false})).status).toBe(403);
  });
  it('limits recovery by normalized destination independently of the IP limit', async () => {
    vi.stubEnv('RATE_LIMIT_IN_TEST','true');
    // Dedicated limiter harness avoids the application's IP limiter masking
    // the separate destination quota. No business handler or mail is invoked.
    const { validate } = await import('../../middleware/validate.js');
    const { resendVerificationSchema } = await import('../../validation/authSchemas.js');
    const isolated = express();
    isolated.use(express.json());
    isolated.post('/recover',validate(resendVerificationSchema),verificationAccountLimiter,(_req,res)=>res.json({ok:true}));
    const origin = await listen(isolated);
    for (const email of [validBody.email,validBody.email.toUpperCase(),' '+validBody.email+' ']) {
      expect((await request({method:'POST',path:'/recover'},{origin,body:{...validBody,email}})).status).toBe(200);
    }
    const blocked = await request({method:'POST',path:'/recover'},{origin});
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await request({method:'POST',path:'/recover'},{origin,body:{...validBody,email:'different@example.test'}})).status).toBe(200);
  });
  it("does not exempt namespace lookalikes from rate limiting", async () => {
    vi.stubEnv("RATE_LIMIT_IN_TEST", "true");
    for (const path of ["/api/v1/authentication", "/api/v1/payment-other", "/API/v1/USERS-other"]) {
      const res = await request({ method: "GET", path });
      expect(res.status).toBe(404);
      expect(res.headers.get("ratelimit-limit")).toBe("10000");
    }
  });
  it.each([
    ["POST", "/api/v1/auth/register"], ["POST", "/api/v1/auth/login"],
    ["POST", "/api/v1/auth/forgot-password"], ["POST", `/api/v1/auth/reset-password/${id}`],
    ["POST", "/api/v1/auth/send-verification-email"], ["GET", `/api/v1/auth/verify-email/${id}`],
    ['POST', '/api/v1/auth/resend-verification'],
    ["POST", "/api/v1/auth/refresh"], ["POST", "/api/v1/auth/2fa/verify"],
    ["PATCH", "/api/v1/auth/update-password"], ["PATCH", "/api/v1/users/change-password"],
  ])("throttles %s %s in production despite RATE_LIMIT_ENABLED=false", async (method, path) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "false");
    for (let i = 0; i < 3; i++) expect((await request({ method, path }, { withCsrf: false })).status).not.toBe(429);
    const res = await request({ method, path }, { withCsrf: false });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });
  it("requires a valid Stripe signature and retains the exact raw body", async () => {
    const route = { method: "POST", path: "/api/v1/payment/webhook" };
    expect((await request(route, { withCsrf: false })).status).toBe(400);
    expect((await request(route, { withCsrf: false, headers: { "stripe-signature": "invalid" } })).status).toBe(400);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const payload = JSON.stringify({ id: "evt_route_test", type: "route.test", created: Math.floor(Date.now() / 1000), data: { object: {} } }, null, 2);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
    const res = await fetch(`${base}${route.path}`, { method: "POST", body: payload,
      headers: { "Content-Type": "application/json", "stripe-signature": signature } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });
  it("has an independent webhook budget", async () => {
    vi.stubEnv("RATE_LIMIT_IN_TEST", "true");
    const route = { method: "POST", path: "/api/v1/payment/webhook" };
    for (let i = 0; i < 3; i++) expect((await request(route, { withCsrf: false })).status).toBe(400);
    expect((await request(route, { withCsrf: false })).status).toBe(429);
    expect((await request({ method: "GET", path: "/api/v1/payment/payment-methods" })).status).toBe(401);
  });
});
