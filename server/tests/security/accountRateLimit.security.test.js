import express from "express";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { listenForFetch } from "../helpers/listenForFetch.js";
vi.mock("../../controllers/cartController.js", () => {
  const handle = (_req, res) => res.json({ ok: true });
  return { getCart: handle, addToCart: handle, updateCartItem: handle, removeFromCart: handle, clearCart: handle, applyCoupon: handle, removeCoupon: handle };
});
vi.mock("../../middleware/authMiddleware.js", () => ({
  protect: (req, res, next) => {
    if (!req.headers["x-fixture-user"]) return res.sendStatus(401);
    req.user = { id: req.headers["x-fixture-user"] };
    next();
  },
  verifiedEmail: (_req, _res, next) => next(),
}));
vi.mock("../../middleware/logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
let server;
let url;
beforeAll(async () => {
  vi.stubEnv("RATE_LIMIT_IN_TEST", "true");
  vi.stubEnv("RATE_USER_ACTION_MAX", "2");
  const { default: cart } = await import("../../routes/cartRoutes.js");
  const app = express();
  app.set("trust proxy", 1);
  app.use("/cart", cart);
  server = http.createServer(app);
  await listenForFetch(server);
  url = `http://127.0.0.1:${server.address().port}/cart`;
});
afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
  vi.unstubAllEnvs();
});
const readCart = (user, ip) => fetch(url, { headers: { "x-fixture-user": user, "x-forwarded-for": ip } });

describe("protected route account budgets", () => {
  it("keeps the account bucket across changing IPs", async () => {
    expect((await readCart("buyer-a", "192.0.2.1")).status).toBe(200);
    expect((await readCart("buyer-a", "192.0.2.2")).status).toBe(200);
    expect((await readCart("buyer-a", "192.0.2.3")).status).toBe(429);
  });
  it("does not consume another account's bucket on the same IP", async () => {
    expect((await readCart("buyer-b", "192.0.2.1")).status).toBe(200);
    expect((await readCart("buyer-c", "192.0.2.1")).status).toBe(200);
  });
  it("rejects unauthenticated requests before the account bucket", async () => {
    expect((await fetch(url)).status).toBe(401);
  });
});
