import { afterEach, describe, expect, it, vi } from "vitest";
import { getTrustProxy, validateSecurityConfiguration } from "../../config/security.js";
import { buildCsrfToken } from "../../utils/csrf.js";
afterEach(() => vi.unstubAllEnvs());

describe("production security configuration", () => {
  it("requires a distinct CSRF key and refuses disabled TLS verification", () => {
    expect(() => validateSecurityConfiguration({ NODE_ENV: "production", JWT_SECRET: "jwt" })).toThrow(/CSRF_SECRET/);
    expect(() => validateSecurityConfiguration({ NODE_ENV: "production", JWT_SECRET: "jwt", CSRF_SECRET: "jwt" })).toThrow(/distinct/);
    expect(() => validateSecurityConfiguration({ NODE_ENV: "production", JWT_SECRET: "jwt", CSRF_SECRET: "csrf" })).not.toThrow();
    expect(() => validateSecurityConfiguration({ NODE_TLS_REJECT_UNAUTHORIZED: "0" })).toThrow(/TLS/);
  });
  it("does not use a development fallback when generating production CSRF tokens", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CSRF_SECRET", "");
    expect(() => buildCsrfToken("anon:binding")).toThrow(/CSRF_SECRET/);
    vi.stubEnv("CSRF_SECRET", "isolated-csrf-secret");
    expect(buildCsrfToken("anon:binding")).toHaveLength(64);
  });
  it("supports explicit proxy hop/address configuration and rejects blanket trust", () => {
    expect(getTrustProxy("0")).toBe(0);
    expect(getTrustProxy("2")).toBe(2);
    expect(getTrustProxy("false")).toBe(false);
    expect(getTrustProxy("loopback, 10.0.0.0/8")).toEqual(["loopback", "10.0.0.0/8"]);
    expect(() => getTrustProxy("true")).toThrow(/TRUST_PROXY/);
  });
});
