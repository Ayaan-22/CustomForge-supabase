import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatLogDate, isValidLogDate, listLogDates, readLogLines } from "../../utils/logFiles.js";

const DAY = "2026-10-06";
let directory;

beforeEach(async () => {
  directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "forge-log-files-"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.promises.rm(directory, { recursive: true, force: true });
});

async function fixture(name, contents = "entry\n") {
  await fs.promises.writeFile(path.join(directory, name), name.endsWith(".gz") ? gzipSync(contents) : contents);
}

async function collect(date = DAY, logDir = directory) {
  const rows = [];
  for await (const row of readLogLines(logDir, date)) rows.push(row);
  return rows;
}

function trackHandles(onOpen) {
  const handles = [];
  const realOpen = fs.promises.open.bind(fs.promises);
  vi.spyOn(fs.promises, "open").mockImplementation(async (...args) => {
    const handle = await realOpen(...args);
    handles.push({ handle, close: vi.spyOn(handle, "close") });
    onOpen?.(handle);
    return handle;
  });
  return handles;
}

describe("application log calendar dates", () => {
  it("formats the local calendar day across midnight instead of the UTC day", () => {
    const originalZone = process.env.TZ;
    try {
      process.env.TZ = "Asia/Karachi";
      const afterMidnight = new Date("2026-10-05T19:30:00.000Z");
      expect(afterMidnight.getDate()).toBe(6);
      expect(afterMidnight.toISOString().slice(0, 10)).toBe("2026-10-05");
      expect(formatLogDate(afterMidnight)).toBe("2026-10-06");
      expect(formatLogDate(new Date("2026-10-05T18:59:59.000Z"))).toBe("2026-10-05");
    } finally {
      if (originalZone == null) delete process.env.TZ;
      else process.env.TZ = originalZone;
    }
  });

  it("rejects invalid calendar dates and traversal while allowing real leap dates", () => {
    expect(isValidLogDate("2024-02-29")).toBe(true);
    expect(isValidLogDate("2026-10-06")).toBe(true);
    for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-10-00", "2026-1-06", "../2026-10-06", "2026-10-06/../", "2026-10-06.log", undefined, null, [DAY]]) {
      expect(isValidLogDate(date)).toBe(false);
    }
    expect(() => formatLogDate(new Date("invalid"))).toThrow(RangeError);
  });

  it("discovers unique newest-first dates from supported application files only", async () => {
    for (const name of ["application-2026-10-06.log", "application-2026-10-06.log.2.gz", "application-2026-10-05.log.gz", "application-2026-10-04.log.1", "error-2026-10-07.log", "exceptions-2026-10-08.log", "rejections-2026-10-09.log", "application-2026-02-30.log", "application-2026-10-10.log.tmp"]) await fixture(name);
    await fs.promises.mkdir(path.join(directory, "application-2026-10-11.log"));
    expect(await listLogDates(directory)).toEqual(["2026-10-06", "2026-10-05", "2026-10-04"]);
  });
});

describe("streamed daily application logs", () => {
  it("orders numeric parts, reads gzip, prefers plain duplicates and numbers lines per file", async () => {
    await fixture(`application-${DAY}.log`, "base\r\n\r\nsecond\n");
    await fixture(`application-${DAY}.log.gz`, "duplicate base\n");
    await fixture(`application-${DAY}.log.10.gz`, "ten\n");
    await fixture(`application-${DAY}.log.2.gz`, "two\n");
    await fixture(`application-${DAY}.log.1`, "one\n");
    await fixture(`application-${DAY}.log.1.gz`, "duplicate one\n");
    await fixture(`error-${DAY}.log`, "error-only file\n");
    expect(await collect()).toEqual([
      { line: "base", file: `application-${DAY}.log`, lineNumber: 1 },
      { line: "", file: `application-${DAY}.log`, lineNumber: 2 },
      { line: "second", file: `application-${DAY}.log`, lineNumber: 3 },
      { line: "one", file: `application-${DAY}.log.1`, lineNumber: 1 },
      { line: "two", file: `application-${DAY}.log.2.gz`, lineNumber: 1 },
      { line: "ten", file: `application-${DAY}.log.10.gz`, lineNumber: 1 },
    ]);
  });

  it.each([false, true])("falls back to the same part after its selected source vanishes (gzip=%s)", async gzip => {
    const selected = `application-${DAY}.log${gzip ? ".gz" : ""}`;
    const counterpart = `application-${DAY}.log${gzip ? "" : ".gz"}`;
    await fixture(selected, "rotating source\n");
    const realOpen = fs.promises.open.bind(fs.promises);
    vi.spyOn(fs.promises, "open").mockImplementation(async (file, ...args) => {
      if (path.basename(file) === selected) {
        await fixture(counterpart, "preserved source\n");
        await fs.promises.unlink(path.join(directory, selected));
      }
      return realOpen(file, ...args);
    });
    expect(await collect()).toEqual([{ line: "preserved source", file: counterpart, lineNumber: 1 }]);
  });

  it("returns empty results for a missing directory or missing day", async () => {
    const absent = path.join(directory, "absent");
    expect(await listLogDates(absent)).toEqual([]);
    expect(await collect(DAY, absent)).toEqual([]);
    await fixture("application-2026-10-05.log", "another day\n");
    expect(await collect()).toEqual([]);
    await expect(collect("../2026-10-06")).rejects.toThrow(RangeError);
  });

  it("preserves directory and source permission errors instead of treating them as empty", async () => {
    await fixture(`application-${DAY}.log`);
    await expect(listLogDates(path.join(directory, `application-${DAY}.log`))).rejects.toMatchObject({ code: "ENOTDIR" });
    const permissionError = Object.assign(new Error("Access denied"), { code: "EACCES" });
    vi.spyOn(fs.promises, "open").mockRejectedValue(permissionError);
    await expect(collect()).rejects.toBe(permissionError);
  });

  it("propagates corrupt gzip and closes its file handle", async () => {
    await fs.promises.writeFile(path.join(directory, `application-${DAY}.log.gz`), "not gzip");
    const handles = trackHandles();
    await expect(collect()).rejects.toMatchObject({ code: "Z_DATA_ERROR" });
    expect(handles).toHaveLength(1);
    expect(handles[0].close).toHaveBeenCalledTimes(1);
    await expect(handles[0].handle.stat()).rejects.toMatchObject({ code: "EBADF" });
  });

  it("preserves a source I/O error and cleans up its stream and file handle", async () => {
    await fixture(`application-${DAY}.log`);
    const ioError = Object.assign(new Error("Read failed"), { code: "EIO" });
    const input = new PassThrough();
    const handles = trackHandles(handle => {
      vi.spyOn(handle, "createReadStream").mockImplementation(() => {
        queueMicrotask(() => input.destroy(ioError));
        return input;
      });
    });
    await expect(collect()).rejects.toBe(ioError);
    expect(input.destroyed).toBe(true);
    expect(handles[0].close).toHaveBeenCalledTimes(1);
    await expect(handles[0].handle.stat()).rejects.toMatchObject({ code: "EBADF" });
  });

  it.each([false, true])("closes resources when the consumer stops after one line (gzip=%s)", async gzip => {
    await fixture(`application-${DAY}.log${gzip ? ".gz" : ""}`, "first\nsecond\nthird\n");
    const handles = trackHandles();
    const iterator = readLogLines(directory, DAY);
    expect(await iterator.next()).toMatchObject({ value: { line: "first", lineNumber: 1 }, done: false });
    await iterator.return();
    expect(handles).toHaveLength(1);
    expect(handles[0].close).toHaveBeenCalledTimes(1);
    await expect(handles[0].handle.stat()).rejects.toMatchObject({ code: "EBADF" });
  });
});
