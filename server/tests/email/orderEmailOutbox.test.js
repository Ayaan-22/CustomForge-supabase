import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../config/db.js", () => ({ getServiceClient: vi.fn() }));
vi.mock("../../middleware/logger.js", () => ({ logger: { error: vi.fn() } }));
import { processOrderEmailOutbox } from "../../utils/orderEmailOutbox.js";
import Email from "../../utils/email.js";
import net from 'node:net';
import { EventEmitter } from 'node:events';
import tls from 'node:tls';
import SMTPConnection from 'nodemailer/lib/smtp-connection';
const job = { id: "job", order_id: "order", lease_token: "lease", recipient_email: "buyer@example.test", recipient_name: "Buyer" };
const order = { id: "order", total_price: 11, orderItems: [{ name: "CPU", price: 10, quantity: 1 }] };
const clientFor = (finishResult = { data: true }, renewResult = { data: true }) => {
  let claimed = false;
  return {
    rpc: vi.fn(async name => {
      if (name === 'claim_order_emails') { if (claimed) return { data: [] }; claimed = true; return { data: [job] }; }
      if (name === 'renew_order_email_lease') return renewResult;
      if (name === 'finish_order_email') return finishResult;
      throw new Error('Unexpected RPC');
    }),
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order }) }) }) })),
  };
};
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("durable order email delivery", () => {
  it("marks delivery complete only after successful send", async () => {
    const client = clientFor();
    const send = vi.fn(async () => {
      expect(client.rpc).toHaveBeenCalledTimes(2);
    });
    expect(await processOrderEmailOutbox({ client, send })).toBe(1);
    expect(send).toHaveBeenCalledWith(job, order, { signal: expect.any(AbortSignal) });
    expect(client.rpc).toHaveBeenNthCalledWith(3, "finish_order_email", {
      p_id: "job", p_lease_token: "lease", p_success: true, p_error: null,
    });
  });
  it("persists retryable failure without storing SMTP responses", async () => {
    const client = clientFor();
    await processOrderEmailOutbox({ client, send: async () => { throw new Error("SMTP contains sensitive response"); } });
    expect(client.rpc).toHaveBeenNthCalledWith(3, "finish_order_email", {
      p_id: "job", p_lease_token: "lease", p_success: false, p_error: "DELIVERY_FAILED",
    });
  });
  it("does not acknowledge a replaced lease or pretend an acknowledgement failure succeeded", async () => {
    const send = vi.fn();
    await expect(processOrderEmailOutbox({ client: clientFor({ data: false }), send })).rejects.toThrow(/lease/);
    await expect(processOrderEmailOutbox({ client: clientFor({ error: { message: "database unavailable" } }), send })).rejects.toThrow(/persist/);
  });
  it("does not send when claiming the queue fails", async () => {
    const send = vi.fn();
    await expect(processOrderEmailOutbox({ client: { rpc: async () => ({ error: {} }) }, send })).rejects.toThrow(/claim/);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send or acknowledge after losing its lease before SMTP starts', async () => {
    const client = clientFor({ data: true }, { data: false });
    const send = vi.fn();
    await expect(processOrderEmailOutbox({ client, send })).rejects.toThrow(/lease renewal/);
    expect(send).not.toHaveBeenCalled();
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual(['claim_order_emails', 'renew_order_email_lease']);
  });

  it('aborts delivery and stops claiming when periodic renewal fails', async () => {
    vi.useFakeTimers();
    const client = clientFor();
    const original = client.rpc.getMockImplementation();
    let renewals = 0;
    client.rpc.mockImplementation(async (name, args) => name === 'renew_order_email_lease' && ++renewals > 1
      ? { error: { message: 'Database unavailable' } } : original(name, args));
    let signal;
    const send = vi.fn((_job, _order, options) => { signal = options.signal; return new Promise(() => {}); });
    const pending = processOrderEmailOutbox({ client, send, renewalIntervalMs: 20, workTimeoutMs: 1000 });
    const failed = expect(pending).rejects.toThrow(/lease renewal/);
    await vi.advanceTimersByTimeAsync(21);
    await failed;
    expect(send).toHaveBeenCalledTimes(1);
    expect(signal.aborted).toBe(true);
    expect(client.rpc.mock.calls.filter(([name]) => name === 'claim_order_emails')).toHaveLength(1);
    expect(client.rpc.mock.calls.some(([name]) => name === 'finish_order_email')).toBe(false);
  });

  it('bounds a stuck order lookup and forwards cancellation to PostgREST', async () => {
    vi.useFakeTimers();
    const client = clientFor();
    let querySignal;
    const query = { abortSignal: vi.fn(signal => { querySignal = signal; return new Promise(() => {}); }) };
    client.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => query }) }) });
    const send = vi.fn();
    const pending = processOrderEmailOutbox({ client, send, workTimeoutMs: 50 });
    const failed = expect(pending).rejects.toThrow(/deadline/);
    await vi.advanceTimersByTimeAsync(51);
    await failed;
    expect(querySignal.aborted).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it('closes an in-flight SMTP transport at the absolute job deadline without acknowledging', async () => {
    vi.useFakeTimers();
    const client = clientFor();
    const transport = { sendMail: vi.fn(() => new Promise(() => {})), close: vi.fn() };
    vi.spyOn(Email.prototype, 'newTransport').mockReturnValue(transport);
    const pending = processOrderEmailOutbox({ client, workTimeoutMs: 50 });
    const failed = expect(pending).rejects.toThrow(/deadline/);
    await vi.advanceTimersByTimeAsync(51);
    await failed;
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    expect(transport.close).toHaveBeenCalled();
    expect(client.rpc.mock.calls.some(([name]) => name === 'finish_order_email')).toBe(false);
    expect(client.rpc.mock.calls.filter(([name]) => name === 'claim_order_emails')).toHaveLength(1);
  });

  it('passes the delivery signal to its owned SMTP socket and keeps TLS upgrade enabled', async () => {
    vi.stubEnv('EMAIL_USERNAME', 'sender@example.test');
    vi.stubEnv('EMAIL_PASSWORD', 'test-only');
    vi.stubEnv('EMAIL_PORT', '465');
    const signal = new AbortController().signal;
    const socket = new EventEmitter();
    socket.destroy = vi.fn();
    const connect = vi.spyOn(net, 'createConnection').mockReturnValue(socket);
    const transport = new Email({ email: 'customer@example.test' }, 'https://store.example.test', { signal }).newTransport();
    const provided = vi.fn();
    transport.options.getSocket({ host: 'smtp.example.test', port: 465 }, provided);
    expect(connect).toHaveBeenCalledWith({ host: 'smtp.example.test', port: 465, signal });
    socket.emit('connect');
    expect(provided).toHaveBeenCalledWith(null, { connection: socket, secured: false });
    expect(transport.options).toMatchObject({ secure: true, requireTLS: false, tls: { rejectUnauthorized: true } });
    transport.close();
  });

  it('the installed SMTP client upgrades a supplied raw socket with verified TLS on port 465', async () => {
    const raw = new EventEmitter();
    raw.resume = vi.fn();
    const secured = new EventEmitter();
    secured.setTimeout = vi.fn();
    const connect = vi.spyOn(tls, 'connect').mockImplementation((_options, callback) => {
      queueMicrotask(callback);
      return secured;
    });
    const connection = new SMTPConnection({ connection: raw, secured: false, secure: true, host: 'smtp.example.test', port: 465,
      tls: { rejectUnauthorized: true } });
    vi.spyOn(connection, '_setupConnectionHandlers').mockImplementation(() => {});
    const ready = vi.spyOn(connection, '_onConnect').mockImplementation(() => {});
    connection.connect();
    await new Promise(resolve => setImmediate(resolve));
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ socket: raw, servername: 'smtp.example.test', rejectUnauthorized: true }), expect.any(Function));
    expect(connection.secure).toBe(true);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('requires STARTTLS and rejects its failure before authentication on port 587', () => {
    vi.stubEnv('EMAIL_USERNAME', 'sender@example.test');
    vi.stubEnv('EMAIL_PASSWORD', 'test-only');
    vi.stubEnv('EMAIL_PORT', '587');
    const transport = new Email({ email: 'customer@example.test' }, 'https://store.example.test', { signal: new AbortController().signal }).newTransport();
    expect(transport.options).toMatchObject({ secure: false, requireTLS: true, tls: { rejectUnauthorized: true } });
    const connection = new SMTPConnection(transport.options);
    const command = vi.spyOn(connection, '_sendCommand').mockImplementation(() => {});
    const error = vi.spyOn(connection, '_onError').mockImplementation(() => {});
    const authenticated = vi.fn();
    connection.on('connect', authenticated);
    connection._actionEHLO('250-smtp.example.test\r\n250 AUTH LOGIN');
    expect(command).toHaveBeenCalledWith('STARTTLS');
    expect(authenticated).not.toHaveBeenCalled();
    connection._actionSTARTTLS('454 TLS unavailable');
    expect(error).toHaveBeenCalledWith(expect.any(Error), 'ETLS', '454 TLS unavailable', 'STARTTLS');
    expect(authenticated).not.toHaveBeenCalled();
    transport.close();
  });

  it('does not open an SMTP socket after cancellation', () => {
    vi.stubEnv('EMAIL_USERNAME', 'sender@example.test');
    vi.stubEnv('EMAIL_PASSWORD', 'test-only');
    const controller = new AbortController();
    controller.abort(new Error('Lease ownership lost'));
    const connect = vi.spyOn(net, 'createConnection');
    const transport = new Email({ email: 'customer@example.test' }, 'https://store.example.test', { signal: controller.signal }).newTransport();
    const provided = vi.fn();
    transport.options.getSocket({ host: 'smtp.example.test', port: 465 }, provided);
    expect(connect).not.toHaveBeenCalled();
    expect(provided).toHaveBeenCalledWith(controller.signal.reason);
    transport.close();
  });
});
