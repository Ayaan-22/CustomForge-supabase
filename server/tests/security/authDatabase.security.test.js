import {listenForFetch} from "../helpers/listenForFetch.js";
import http from 'node:http';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [], calls: [], mail: [], failMail: false }));
// Mock only the external database/mail transport. Real auth controller, user
// model, bcrypt, JWT, validation and the credential-client boundary run here.
vi.mock('@supabase/supabase-js', () => ({ createClient: (_url, key) => ({
  from(table) {
    const call = { key, table, filters: [] };
    state.calls.push(call);
    let operation = 'select'; let payload; let single = false;
    const query = {
      select() { return this; },
      insert(value) { operation = 'insert'; payload = value; return this; },
      update(value) { operation = 'update'; payload = value; return this; },
      eq(field, value) { call.filters.push([field, value]); return this; },
      ilike(field, value) { call.filters.push([field, value]); return this; },
      single() { single = true; return this; },
      maybeSingle() { single = true; return this; },
      then(resolve, reject) {
        if (key !== 'test-service-key' || table !== 'users') {
          return Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for table users' } }).then(resolve, reject);
        }
        let rows = state.rows.filter(row => call.filters.every(([field, value]) => row[field] === value));
        if (operation === 'insert') {
          rows = payload.map(row => ({ id: '10000000-0000-4000-8000-000000000001', ...row }));
          state.rows.push(...rows);
        }
        if (operation === 'update') rows.forEach(row => Object.assign(row, payload));
        return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject);
      },
    };
    return query;
  },
}) }));
vi.mock('../../utils/email.js', () => ({ default: class {
  constructor(user, url) { this.user = user; this.url = url; }
  async sendWelcome(options) { state.mail.push({ kind: 'welcome', url: this.url, ...options }); }
  async sendVerificationEmail() { if (state.failMail) throw new Error('SMTP unavailable'); state.mail.push({ kind: 'verification', url: this.url }); }
  async sendPasswordReset() { state.mail.push({ kind: 'reset', url: this.url }); }
} }));
vi.mock('../../middleware/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import authRoutes from '../../routes/authRoutes.js';
import { protect } from '../../middleware/authMiddleware.js';
import { getAuthClient, getSupabaseClient } from '../../config/db.js';
import { hashToken, signToken, verifyEmailToken } from '../../utils/generateToken.js';
import { publicUser } from '../../utils/publicUser.js';
import { comparePassword } from '../../models/User.js';

let server; let base;
const input = { name: 'Auth Tester', email: 'auth@example.test', password: 'SamplePassword123!', passwordConfirm: 'SamplePassword123!' };
const request = async (route, body, headers = {}) => {
  const response = await fetch(`${base}/api/v1/auth${route}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() };
};
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const { default: cookieParser } = await import('cookie-parser');
  app.use(cookieParser());
  app.use('/api/v1/auth', authRoutes);
  app.get('/identity', protect, (req, res) => res.json(publicUser(req.user)));
  app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ message: err.message }));
  server = http.createServer(app);
  await listenForFetch(server);
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => { state.rows = []; state.calls = []; state.mail = []; state.failMail = false; });
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

describe('custom authentication with locked-down users table', () => {
  it('registers without anonymous users access, hashes credentials and strips role injection', async () => {
    const result = await request('/register', { ...input, role: 'admin', isEmailVerified: true });
    expect(result.status).toBe(201);
    expect(result.body.data.user.role).toBe('user');
    expect(result.body.data.user.isEmailVerified).toBe(false);
    expect(result.body.data.user).not.toHaveProperty('password');
    expect(result.body.data.user).not.toHaveProperty('emailVerificationToken');
    expect(state.mail[0]).toMatchObject({ kind: 'welcome', verifyEmail: true });
    expect(await comparePassword(input.password, state.rows[0].password)).toBe(true);
    const token = state.mail[0].url.split('/').at(-1);
    expect(state.rows[0].email_verification_token).toBe(hashToken(token));
    expect(state.calls.every(call => call.key === 'test-service-key' && call.table === 'users')).toBe(true);
    const anon = await getSupabaseClient({ headers: {} }).from('users').select('id');
    expect(anon.error.code).toBe('42501');
  });

  it('rejects mismatched passwords before a database query', async () => {
    expect((await request('/register', { ...input, passwordConfirm: 'DifferentPassword123!' })).status).toBe(400);
    expect(state.calls).toHaveLength(0);
  });

  it('recovers an unverified account without a session and verifies the new link', async () => {
    await request('/register', input);
    const oldToken = state.mail[0].url.split('/').at(-1);
    expect((await request('/login', input)).status).toBe(401);
    const recovery = await request('/resend-verification', { email: ' AUTH@example.test ', password: input.password });
    expect(recovery.status).toBe(200);
    expect(recovery.cookies).toEqual([]);
    expect(recovery.body).not.toHaveProperty('token');
    expect(recovery.body).not.toHaveProperty('accessToken');
    expect(recovery.body.data).not.toHaveProperty('user');
    expect(state.rows[0].is_email_verified).toBe(false);
    const newToken = state.mail.at(-1).url.split('/').at(-1);
    expect(newToken).not.toBe(oldToken);
    expect(state.rows[0].email_verification_token).toBe(hashToken(newToken));
    expect((await request(`/verify-email/${oldToken}`)).status).toBe(400);
    expect((await request(`/verify-email/${newToken}`)).status).toBe(200);
    expect((await request('/login', input)).status).toBe(200);
  }, 20000);

  it('requires password proof, rejects disabled accounts and validates input', async () => {
    await request('/register', input);
    const original = state.rows[0].email_verification_token;
    const missing = await request('/resend-verification', {email:'unknown@example.test',password:input.password});
    const wrong = await request('/resend-verification', {email:input.email,password:'WrongPassword123!'});
    expect(missing.status).toBe(401); expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(missing.body);
    expect((await request('/resend-verification', {email:input.email})).status).toBe(400);
    state.rows[0].active = false;
    expect((await request('/resend-verification', input)).status).toBe(401);
    expect(state.mail).toHaveLength(1);
    expect(state.rows[0].email_verification_token).toBe(original);
  }, 20000);

  it('does not send mail or issue a session for an already verified account', async () => {
    await request('/register', input);
    state.rows[0].is_email_verified = true;
    const result = await request('/resend-verification', input);
    expect(result.status).toBe(200);
    expect(result.body.data.message).toContain('already verified');
    expect(result.cookies).toEqual([]);
    expect(state.mail).toHaveLength(1);
  });

  it('reports a delivery failure without claiming a message was sent or verifying the user', async () => {
    await request('/register', input);
    state.failMail = true;
    const result = await request('/resend-verification', input);
    expect(result.status).toBe(503);
    expect(result.body.message).toContain('Unable to send');
    expect(result.cookies).toEqual([]);
    expect(state.rows[0].is_email_verified).toBe(false);
    expect(state.mail).toHaveLength(1);
  });

  it('resends the verification template with a newly rotated action link', async () => {
    await request('/register', input);
    const originalUrl = state.mail[0].url;
    // This token is signed only with the isolated test secret from setup.js.
    const bearer = signToken(state.rows[0].id, 'user');
    const result = await request('/send-verification-email', {}, { Authorization: `Bearer ${bearer}` });
    expect(result.status).toBe(200);
    expect(state.mail.at(-1).kind).toBe('verification');
    expect(state.mail.at(-1).url).not.toBe(originalUrl);
    expect(state.mail.at(-1).url).toContain('/verify-email/');
    expect(state.rows[0].email_verification_token).toBe(hashToken(state.mail.at(-1).url.split('/').at(-1)));
  });

  it('verifies email, logs in, refreshes and authenticates without exposing credential fields', async () => {
    await request('/register', input);
    expect((await request('/login', input)).status).toBe(401);
    const token = state.mail[0].url.split('/').at(-1);
    const verified = await request(`/verify-email/${token}`);
    expect(verified.status).toBe(200);
    expect(verified.body.data.user.isEmailVerified).toBe(true);
    expect(state.rows[0].email_verification_token).toBeNull();
    expect((await request(`/verify-email/${token}`)).status).toBe(400);
    expect((await request('/login', { ...input, password: 'WrongPassword123!' })).status).toBe(401);
    const loggedIn = await request('/login', input);
    expect(loggedIn.status).toBe(200);
    const identity = await fetch(`${base}/identity`, { headers: { Authorization: `Bearer ${loggedIn.body.accessToken}` } });
    expect(identity.status).toBe(200);
    expect(await identity.json()).not.toHaveProperty('twoFactorSecret');
    const refreshCookie = loggedIn.cookies.find(cookie => cookie.startsWith('refresh_token=')).split(';')[0];
    expect((await request('/refresh', {}, { Cookie: refreshCookie })).status).toBe(200);
    state.rows[0].active = false;
    expect((await request('/login', input)).status).toBe(403);
  }, 20000); // Multiple real cost-12 bcrypt comparisons under parallel suite load.

  it('uses explicit credential access for reset tokens and rejects invalid or expired tokens', async () => {
    await request('/register', input);
    expect((await request('/reset-password/invalid', input)).status).toBe(400);
    await request('/forgot-password', { email: input.email });
    const token = state.mail.at(-1).url.split('/').at(-1);
    expect(state.rows[0].password_reset_token).toBe(hashToken(token));
    state.rows[0].password_reset_expires = new Date(0).toISOString();
    expect((await request(`/reset-password/${token}`, input)).status).toBe(400);
    await request('/forgot-password', { email: input.email });
    const nextToken = state.mail.at(-1).url.split('/').at(-1);
    const password = 'ChangedPassword123!';
    expect((await request(`/reset-password/${nextToken}`, { password, passwordConfirm: password })).status).toBe(200);
    expect(await comparePassword(password, state.rows[0].password)).toBe(true);
    expect(state.rows[0].password_reset_token).toBeNull();
  }, 20000);

  it('does not touch credentials for a forged bearer token', async () => {
    expect((await fetch(`${base}/identity`, { headers: { Authorization: `Bearer ${randomUUID()}` } })).status).toBe(401);
    expect(state.calls).toHaveLength(0);
  });

  it('cannot use the credential client for catalog, orders or RPC, and requires explicit token-verification clients', async () => {
    const client = getAuthClient();
    for (const table of ['products', 'orders', 'carts', 'users,orders']) expect(() => client.from(table)).toThrow(/only access users/);
    expect(client.rpc).toBeUndefined();
    expect(client.schema).toBeUndefined();
    expect(client.from('users').delete).toBeUndefined();
    await expect(verifyEmailToken('invalid')).rejects.toThrow(/Explicit auth client/);
  });
});
