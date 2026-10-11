import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ from: vi.fn(() => "relation"), rpc: vi.fn(() => "result") }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: state.from, rpc: state.rpc }) }));
import { getServiceClient } from "../../config/db.js";
import { requestContextMiddleware } from "../../utils/requestContext.js";

const inRequest = (path, callback) => {
  let value;
  requestContextMiddleware({ path, method: "GET", originalUrl: path }, {}, () => { value = callback(); });
  return value;
};
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("service-role boundary", () => {
  it.each(["production", "development", "test"])("rejects customer service-role access in %s", environment => {
    vi.stubEnv("NODE_ENV", environment);
    expect(() => inRequest("/api/v1/orders", () => getServiceClient().from("orders"))).toThrow(/bypasses RLS/);
    expect(state.from).not.toHaveBeenCalled();
  });
  it("blocks a method captured before entering the customer request", () => {
    const rpc = getServiceClient().rpc;
    expect(() => inRequest("/api/v1/users/profile", () => rpc("admin_analytics"))).toThrow(/bypasses RLS/);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("permits approved admin/webhook routes and background workers", () => {
    expect(inRequest("/api/v1/admin/orders", () => getServiceClient().from("orders"))).toBe("relation");
    expect(inRequest("/api/v1/payment/webhook", () => getServiceClient().rpc("settle"))).toBe("result");
    expect(getServiceClient().rpc("claim_order_emails")).toBe("result");
    expect(() => inRequest("/api/v1/admin-impersonation", () => getServiceClient().from("users"))).toThrow();
  });
});
