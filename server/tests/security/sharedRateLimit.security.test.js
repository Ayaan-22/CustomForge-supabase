import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ connect: vi.fn(), create: vi.fn(), command: vi.fn(), destroy: vi.fn(), stores: [], fail: false }));
vi.mock("redis", () => ({ createClient: options => {
  state.create(options);
  return { connect: state.connect, on: vi.fn(), sendCommand: state.command, destroy: state.destroy, isOpen: true, quit: vi.fn() };
} }));
vi.mock("rate-limit-redis", () => ({ RedisStore: class {
  constructor(options) { state.stores.push(options); }
  init() {}
  async increment() {
    if (state.fail) throw new Error("Provider connection details must not leak");
    return { totalHits: 1, resetTime: new Date(Date.now() + 10000) };
  }
  decrement() {}
  resetKey() {}
} }));
vi.mock("../../middleware/logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.stores.length = 0;
  state.fail = false;
  state.connect.mockResolvedValue(undefined);
  vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
  vi.stubEnv("RATE_LIMIT_IN_TEST", "true");
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("configured shared rate limits", () => {
  it("bounds connection attempts, disables offline queuing and isolates limiter keys", async () => {
    await import("../../config/rateLimit.js");
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      disableOfflineQueue: true, socket: { connectTimeout: 5000, reconnectStrategy: false },
    }));
    const prefixes = state.stores.map(store => store.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect(prefixes).toContain("customforge:rate:USER_ACTION:");
  });
  it("fails startup rather than falling back to process memory when Redis is unavailable", async () => {
    state.connect.mockRejectedValue(new Error("unavailable"));
    await expect(import("../../config/rateLimit.js")).rejects.toThrow();
    expect(state.stores).toHaveLength(0);
  });
  it("explains invalid connection configuration without exposing the URL", async () => {
    state.create.mockImplementationOnce(() => { throw new TypeError("invalid URL containing credentials"); });
    await expect(import("../../config/rateLimit.js")).rejects.toThrow(/redis:\/\/ or rediss:\/\/.*Omit REDIS_URL/);
    expect(state.connect).not.toHaveBeenCalled();
    expect(state.stores).toHaveLength(0);
  });
  it("returns a retryable service error without exposing provider details during an outage", async () => {
    const { userActionLimiter } = await import("../../config/rateLimit.js");
    state.fail = true;
    const next = vi.fn();
    await userActionLimiter({ ip: "192.0.2.1", user: { id: "buyer" }, headers: {} }, { setHeader: vi.fn() }, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 503 }));
    expect(next.mock.calls[0][0].message).not.toMatch(/Provider connection/);
  });
  it("bounds a connected store that never answers a command", async () => {
    await import("../../config/rateLimit.js");
    vi.useFakeTimers();
    state.command.mockImplementation(() => new Promise(() => {}));
    const request = state.stores[0].sendCommand("PING");
    const rejected = expect(request).rejects.toThrow(/deadline/);
    await vi.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(state.destroy).toHaveBeenCalledOnce();
  });
});
