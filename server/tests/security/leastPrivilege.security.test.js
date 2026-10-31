import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { protect } from "../../middleware/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "../..");

const read = (rel) => fs.readFileSync(path.join(SERVER_ROOT, rel), "utf8");

describe("least-privilege architecture", () => {
  it("requires explicit client injection in all models", () => {
    const modelFiles = [
      "models/User.js",
      "models/Order.js",
      "models/Cart.js",
      "models/Product.js",
      "models/Review.js",
      "models/Coupon.js",
      "models/Game.js",
      "models/PrebuiltPc.js",
    ];

    for (const file of modelFiles) {
      const text = read(file);
      expect(text).not.toMatch(/client\s*=\s*[a-zA-Z_][\w]*/);
      expect(text).toMatch(/Supabase client is required/);
    }
  });

  it("blocks service-client usage in non-allowed controllers and routes", () => {
    const disallowed = [
      "controllers/authController.js",
      "controllers/cartController.js",
      "controllers/orderController.js",
      "controllers/productController.js",
      "controllers/reviewController.js",
      "controllers/userController.js",
      "routes/authRoutes.js",
      "routes/cartRoutes.js",
      "routes/orderRoutes.js",
      "routes/productRoutes.js",
      "routes/reviewRoutes.js",
      "routes/userRoutes.js",
    ];

    for (const file of disallowed) {
      const text = read(file);
      expect(text).not.toMatch(/getServiceClient\s*\(/);
    }
  });

  it("keeps service-client access only in approved backend paths", () => {
    const admin = read("controllers/adminController.js");
    const payment = read("controllers/paymentController.js");
    expect(admin).toMatch(/getServiceClient/);
    expect(payment).toMatch(/getServiceClient/);
  });

  it("requires JWT for protected endpoints", async () => {
    const req = { headers: {}, cookies: {} };
    const res = {};
    let errorPassed;
    const next = (err) => {
      errorPassed = err;
    };

    await protect(req, res, next);
    expect(errorPassed).toBeDefined();
    expect(errorPassed.message).toMatch(/logged in|token/i);
  });

  it("contains RLS policies for critical tables", () => {
    const sql = read("models/migrations/20260430_security_hardening.sql");
    for (const table of ["users", "orders", "order_items", "cart_items", "reviews"]) {
      expect(sql).toMatch(new RegExp(`alter table ${table} enable row level security`, "i"));
    }
  });
});
