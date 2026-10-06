import { beforeEach, describe, expect, it, vi } from "vitest";

// Keep controller checks entirely in memory: importing the real logger would
// create transports and touch the developer's log directory.
const mocks = vi.hoisted(() => ({
  formatLogDate: vi.fn(),
  isValidLogDate: vi.fn(),
  listLogDates: vi.fn(),
  readLogLines: vi.fn(),
  warn: vi.fn(),
  lines: [],
  readError: null,
}));

vi.mock("../../middleware/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: mocks.warn },
}));
vi.mock("../../utils/logFiles.js", () => ({
  formatLogDate: mocks.formatLogDate,
  isValidLogDate: mocks.isValidLogDate,
  listLogDates: mocks.listLogDates,
  readLogLines: mocks.readLogLines,
}));

import {
  getAllLogs,
  getAvailableLogDates,
  getLogById,
  getLogStats,
} from "../../controllers/logController.js";

const LOCAL_DATE = "2026-10-06";
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ZERO_STATS = {
  total: 0,
  byLevel: {},
  byRoute: {},
  errorCount: 0,
  averageResponseTime: 0,
  uniqueUsers: 0,
};

function sourceEntries(entries) {
  mocks.lines = entries.map((entry, index) => ({
    line: JSON.stringify(entry),
    file: `application-${LOCAL_DATE}.log`,
    lineNumber: index + 1,
  }));
}

async function run(controller, query = {}, params = { id: "target" }) {
  let body;
  const res = {
    status: vi.fn(() => res),
    json: vi.fn((value) => { body = value; }),
  };
  const next = vi.fn();
  await controller({ query, params }, res, next);
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return { statusCode: res.status.mock.calls[0]?.[0], body };
}

beforeEach(() => {
  mocks.lines = [];
  mocks.readError = null;
  mocks.warn.mockReset();
  mocks.formatLogDate.mockReset().mockReturnValue(LOCAL_DATE);
  mocks.isValidLogDate.mockReset().mockImplementation((value) =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && value !== "2026-02-30"
  );
  mocks.listLogDates.mockReset().mockResolvedValue([]);
  mocks.readLogLines.mockReset().mockImplementation(async function* () {
    for (const record of mocks.lines) yield record;
    if (mocks.readError) throw mocks.readError;
  });
});

describe("log date and empty-day contracts", () => {
  it.each([
    ["list", getAllLogs],
    ["statistics", getLogStats],
    ["detail", getLogById],
  ])("uses the local logger date by default for %s", async (_name, controller) => {
    sourceEntries([{ requestId: "target", level: "info", message: "Store ready" }]);
    const { statusCode, body } = await run(controller);
    expect(statusCode).toBe(200);
    expect(mocks.formatLogDate).toHaveBeenCalledOnce();
    expect(mocks.isValidLogDate).toHaveBeenCalledWith(LOCAL_DATE);
    expect(mocks.readLogLines).toHaveBeenCalledWith(expect.any(String), LOCAL_DATE);
    if (controller === getAllLogs) expect(body.filters.date).toBe(LOCAL_DATE);
    if (controller === getLogStats) expect(body.date).toBe(LOCAL_DATE);
  });

  it("returns an empty successful collection when a day has no application events", async () => {
    const result = await run(getAllLogs, { date: LOCAL_DATE, page: "1", limit: "20" });
    expect(result).toEqual({
      statusCode: 200,
      body: {
        status: "success",
        timezone: TIMEZONE,
        pagination: { page: 1, limit: 20, total: 0, pages: 1 },
        filters: { date: LOCAL_DATE, level: undefined, userId: undefined, search: undefined },
        results: 0,
        data: [],
      },
    });
    expect(mocks.formatLogDate).not.toHaveBeenCalled();
  });

  it("returns zero statistics with the selected date and logger timezone for an empty day", async () => {
    expect(await run(getLogStats, { date: LOCAL_DATE })).toEqual({
      statusCode: 200,
      body: { status: "success", date: LOCAL_DATE, timezone: TIMEZONE, data: ZERO_STATS },
    });
  });

  it.each([
    ["empty day", []],
    ["day with other events", [{ requestId: "another-event", level: "info" }]],
  ])(
    "keeps a missing individual event as 404 for a valid %s",
    async (_name, entries) => {
      sourceEntries(entries);
      await expect(run(getLogById, { date: LOCAL_DATE })).rejects.toMatchObject({
        statusCode: 404,
        message: `Log with ID target not found for date ${LOCAL_DATE}`,
      });
    },
  );

  it.each([
    ["list", getAllLogs],
    ["statistics", getLogStats],
    ["detail", getLogById],
  ])("rejects malformed, impossible and non-string dates in %s", async (_name, controller) => {
    for (const date of ["06-10-2026", "2026-02-30", "../2026-10-06", [LOCAL_DATE]]) {
      await expect(run(controller, { date })).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mocks.readLogLines).not.toHaveBeenCalled();
  });
});

describe("event stream filtering, pagination and sanitization", () => {
  it("returns the newest matching events first on later pages", async () => {
    sourceEntries(Array.from({ length: 7 }, (_, index) => ({
      requestId: `event-${index + 1}`,
      level: "info",
      timestamp: `2026-10-06T12:00:0${index}.000Z`,
      message: "Product fetched",
    })));
    const { body } = await run(getAllLogs, { date: LOCAL_DATE, page: "2", limit: "2" });
    expect(body.data.map((entry) => entry.requestId)).toEqual(["event-5", "event-4"]);
    expect(body.pagination).toEqual({ page: 2, limit: 2, total: 7, pages: 4 });
    expect(body.results).toBe(2);
    expect(body.timezone).toBe(TIMEZONE);
  });

  it("applies level, user and case-insensitive search before counting and paging", async () => {
    sourceEntries([
      { requestId: "info", level: "info", userId: "operator", message: "GPU ready" },
      { requestId: "other-user", level: "error", userId: "other", message: "GPU unavailable" },
      { requestId: "older-match", level: "error", userId: "operator", message: "GPU unavailable" },
      { requestId: "other-search", level: "error", userId: "operator", message: "CPU unavailable" },
      { requestId: "newer-match", level: "error", userId: "operator", message: "gpu timeout" },
    ]);
    const { body } = await run(getAllLogs, {
      date: LOCAL_DATE, level: "error", userId: "operator", search: "gPu", page: "2", limit: "1",
    });
    expect(body.data.map((entry) => entry.requestId)).toEqual(["older-match"]);
    expect(body.pagination).toEqual({ page: 2, limit: 1, total: 2, pages: 2 });
    expect(body.filters).toMatchObject({ level: "error", userId: "operator", search: "gPu", date: LOCAL_DATE });
  });

  it("caps valid page sizes at 500 without discarding matched totals", async () => {
    sourceEntries([{ requestId: "one", level: "info" }]);
    const { body } = await run(getAllLogs, { date: LOCAL_DATE, limit: "501" });
    expect(body.pagination).toMatchObject({ limit: 500, total: 1, pages: 1 });
  });

  it("rejects invalid pagination and structured filter values before reading logs", async () => {
    for (const query of [
      { page: "0" }, { page: "1.5" }, { page: "abc" }, { limit: "0" }, { limit: "-1" },
      { page: "9007199254740992" }, { level: ["error"] }, { userId: { id: "operator" } }, { search: ["GPU"] },
    ]) {
      await expect(run(getAllLogs, { date: LOCAL_DATE, ...query })).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mocks.readLogLines).not.toHaveBeenCalled();
  });

  it.each([
    ["list", getAllLogs],
    ["detail", getLogById],
  ])("preserves existing redaction for %s responses", async (_name, controller) => {
    sourceEntries([{
      requestId: "target", level: "info", message: "Order viewed", route: "/api/v1/orders",
      body: { password: "test-secret" }, userAgent: "test-browser", ip: "127.0.0.1",
      password: "test-secret", authorization: "test-token", cookie: "test-cookie",
      meta: { body: { token: "test-token" }, headers: { authorization: "test-token" }, source: "orders" },
    }]);
    const { body } = await run(controller, { date: LOCAL_DATE });
    const entry = controller === getAllLogs ? body.data[0] : body.data;
    expect(entry).toEqual({
      requestId: "target", level: "info", message: "Order viewed", route: "/api/v1/orders",
      meta: { source: "orders" },
    });
  });

  it("skips blank, malformed and non-object lines without hiding valid events", async () => {
    mocks.lines = ["", "  ", "{broken", "null", "42", "[]", JSON.stringify({ requestId: "target", level: "info" })]
      .map((line, index) => ({ line, file: `application-${LOCAL_DATE}.log.1`, lineNumber: index + 1 }));
    const { body } = await run(getAllLogs, { date: LOCAL_DATE });
    expect(body.data).toEqual([{ requestId: "target", level: "info" }]);
    expect(body.pagination.total).toBe(1);
    expect(mocks.warn).toHaveBeenCalledOnce();
    expect(mocks.warn).toHaveBeenCalledWith("Failed to parse log line", expect.objectContaining({
      file: `application-${LOCAL_DATE}.log.1`, line: 3,
    }));
  });
});

describe("daily summaries and available dates", () => {
  it("includes zero response times and groups routes without their query string", async () => {
    sourceEntries([
      { level: "info", route: "/products?page=1", responseTime: 0, userId: "operator" },
      { level: "error", route: "/products?page=2", responseTime: 10, userId: "operator" },
      { level: "warn", route: "/orders", responseTime: "90", userId: "customer" },
      { level: "info", responseTime: -5, userId: "anonymous" },
      { level: "info", responseTime: null },
    ]);
    const { body } = await run(getLogStats, { date: LOCAL_DATE });
    expect(body).toEqual({
      status: "success", date: LOCAL_DATE, timezone: TIMEZONE,
      data: {
        total: 5, byLevel: { info: 3, error: 1, warn: 1 },
        byRoute: { "/products": 2, "/orders": 1 }, errorCount: 1,
        averageResponseTime: 5, uniqueUsers: 2,
      },
    });
  });

  it("returns no synthetic summary counts for malformed and non-object input", async () => {
    mocks.lines = ["{broken", "null", "[]"].map((line, index) => ({
      line, file: `application-${LOCAL_DATE}.log`, lineNumber: index + 1,
    }));
    const { body } = await run(getLogStats, { date: LOCAL_DATE });
    expect(body.data).toEqual(ZERO_STATS);
  });

  it("returns the helper's deduplicated available days and accurate result count", async () => {
    mocks.listLogDates.mockResolvedValue([LOCAL_DATE, "2026-10-05"]);
    expect(await run(getAvailableLogDates)).toEqual({
      statusCode: 200,
      body: { status: "success", results: 2, data: [LOCAL_DATE, "2026-10-05"] },
    });
    expect(mocks.listLogDates).toHaveBeenCalledWith(expect.any(String));
  });

  it("returns a counted empty available-date collection when no application days exist", async () => {
    expect(await run(getAvailableLogDates)).toEqual({
      statusCode: 200, body: { status: "success", results: 0, data: [] },
    });
  });
});

describe("operational failures remain visible", () => {
  it.each([
    ["list", getAllLogs],
    ["statistics", getLogStats],
    ["detail", getLogById],
  ])("reports an actual source error as 500 for %s rather than empty data", async (_name, controller) => {
    sourceEntries([{ requestId: "another-event", level: "info" }]);
    mocks.readError = new Error("EACCES: log source is unreadable");
    await expect(run(controller, { date: LOCAL_DATE })).rejects.toMatchObject({
      statusCode: 500,
      message: expect.stringContaining("EACCES: log source is unreadable"),
    });
  });

  it("reports an available-date discovery failure as 500", async () => {
    mocks.listLogDates.mockRejectedValue(new Error("EIO: directory read failed"));
    await expect(run(getAvailableLogDates)).rejects.toMatchObject({
      statusCode: 500, message: expect.stringContaining("EIO: directory read failed"),
    });
  });
});
