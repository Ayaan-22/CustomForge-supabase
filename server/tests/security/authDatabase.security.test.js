import {listenForFetch} from "../helpers/listenForFetch.js";
import http from 'node:http';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [], calls: [], mail: [], failMail: false, failWrites: false, selectGate: null, writeGate: null }));
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
      is(field, value) { call.filters.push([field, value, 'is']); return this; },
      gt(field, value) { call.filters.push([field, value, 'gt']); return this; },
      ilike(field, value) { call.filters.push([field, value]); return this; },
      single() { single = true; return this; },
      maybeSingle() { single = true; return this; },
      then(resolve, reject) {
        return (async () => {
          if (key !== 'test-service-key' || table !== 'users') {
            return { data: null, error: { code: '42501', message: 'permission denied for table users' } };
          }
          if (operation === 'update' && state.writeGate) await state.writeGate(payload);
          if (operation === 'update' && state.failWrites) return { data: null, error: { message: 'Database unavailable' } };
          let rows = state.rows.filter(row => call.filters.every(([field, value, op]) => op === 'gt' ? row[field] > value : op === 'is' && value === null ? row[field] == null : row[field] === value));
          if (operation === 'insert') {
            rows = payload.map(row => ({ id: '10000000-0000-4000-8000-000000000001', ...row }));
            state.rows.push(...rows);
          }
          if (operation === 'update') rows.forEach(row => Object.assign(row, payload));
          const result = { data: single ? rows[0] ? { ...rows[0] } : null : rows.map(row => ({ ...row })), error: null };
          if (operation === 'select' && state.selectGate) await state.selectGate();
          return result;
        })().then(resolve, reject);
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
import { generateTokenPair, hashToken, signToken, verifyJWT, verifyEmailToken } from '../../utils/generateToken.js';
import { logger } from '../../middleware/logger.js';
import { publicUser } from '../../utils/publicUser.js';
import { comparePassword } from '../../models/User.js';

let server; let base;
const input = { name: 'Auth Tester', email: 'auth@example.test', password: 'SamplePassword123!', passwordConfirm: 'SamplePassword123!' };
const request = async (route, body, headers = {}) => {
  const method = body === undefined && !route.startsWith('/verify-email/') ? 'GET' : 'POST';
  const response = await fetch(`${base}/api/v1/auth${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
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
  app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ message: err.message, ...(err.code ? { code: err.code } : {}) }));
  server = http.createServer(app);
  await listenForFetch(server);
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => { state.rows = []; state.calls = []; state.mail = []; state.failMail = false; state.failWrites = false; state.selectGate = null; state.writeGate = null; vi.restoreAllMocks(); });
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
    const bearer = signToken(state.rows[0].id, 'user', '15m');
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

describe('refresh session lifecycle', () => {
  const createSession = () => {
    const id = '10000000-0000-4000-8000-000000000001';
    const pair = generateTokenPair(id, 'user');
    state.rows = [{ id, name: 'Session Tester', email: 'session@example.test', role: 'user', active: true,
      is_email_verified: true, refresh_token_hash: hashToken(pair.refreshToken),
      refresh_token_expires: pair.refreshExpiresAt.toISOString() }];
    return pair;
  };
  const cookie = token => ({ Cookie: `refresh_token=${token}` });
  const responseRefresh = response => decodeURIComponent(response.cookies.find(value => value.startsWith('refresh_token=')).split(';')[0].slice('refresh_token='.length));

  it('rejects a refresh JWT as bearer before database access, including after revocation', async () => {
    const pair = createSession();
    state.rows[0].refresh_token_hash = null;
    const response = await fetch(`${base}/identity`, { headers: { Authorization: `Bearer ${pair.refreshToken}` } });
    expect(response.status).toBe(401);
    expect(state.calls).toHaveLength(0);
  });

  it('rejects an access JWT in the refresh cookie before database access', async () => {
    const pair = createSession();
    expect((await request('/refresh', {}, cookie(pair.accessToken))).status).toBe(401);
    expect(state.calls).toHaveLength(0);
  });

  it('rotates uniquely within one second and rejects replay of the consumed token', async () => {
    const pair = createSession();
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    try {
      const first = await request('/refresh', {}, cookie(pair.refreshToken));
      expect(first.status).toBe(200);
      const token = responseRefresh(first);
      expect(token).not.toBe(pair.refreshToken);
      expect(state.rows[0].refresh_token_hash).toBe(hashToken(token));
      expect((await request('/refresh', {}, cookie(pair.refreshToken))).status).toBe(401);
      const second = await request('/refresh', {}, cookie(token));
      expect(second.status).toBe(200);
      expect(responseRefresh(second)).not.toBe(token);
    } finally { now.mockRestore(); }
  });

  it('allows only one of two refreshes that both read the same live token', async () => {
    const pair = createSession();
    let releaseReads;
    const bothRead = new Promise(resolve => { releaseReads = resolve; });
    let reads = 0;
    state.selectGate = async () => { if (++reads === 2) releaseReads(); await bothRead; };
    const responses = await Promise.all([request('/refresh', {}, cookie(pair.refreshToken)), request('/refresh', {}, cookie(pair.refreshToken))]);
    state.selectGate = null;
    expect(responses.map(value => value.status).sort()).toEqual([200, 401]);
    const winner = responses.find(value => value.status === 200);
    const loser = responses.find(value => value.status === 401);
    expect(loser.cookies).toEqual([]);
    const winnerToken = responseRefresh(winner);
    expect(state.rows[0].refresh_token_hash).toBe(hashToken(winnerToken));
    expect((await request('/refresh', {}, cookie(winnerToken))).status).toBe(200);
  });

  it('awaits logout revocation before acknowledging success', async () => {
    const pair = createSession();
    let releaseWrite; let enteredWrite;
    const allowed = new Promise(resolve => { releaseWrite = resolve; });
    const entered = new Promise(resolve => { enteredWrite = resolve; });
    state.writeGate = async () => { enteredWrite(); await allowed; };
    let settled = false;
    const response = request('/logout', {}, cookie(pair.refreshToken)).then(value => { settled = true; return value; });
    await entered;
    expect(settled).toBe(false);
    expect(state.rows[0].refresh_token_hash).toBe(hashToken(pair.refreshToken));
    releaseWrite();
    const completed = await response;
    expect(completed.status).toBe(200);
    expect(completed.body.endedAtMs).toEqual(expect.any(Number));
    expect(completed.body.endedAtMs).toBeGreaterThanOrEqual(verifyJWT(pair.accessToken).issuedAtMs);
    expect(state.rows[0].refresh_token_hash).toBeNull();
    expect((await request('/refresh', {}, cookie(pair.refreshToken))).status).toBe(401);
  });

  it('does not rotate a session after a password change wins between read and update', async () => {
    const pair = createSession();
    state.selectGate = async () => {
      state.rows[0].password_changed_at = new Date(Date.now() + 1).toISOString();
    };
    const response = await request('/refresh', {}, cookie(pair.refreshToken));
    expect(response.status).toBe(401);
    expect(response.cookies).toEqual([]);
    expect(state.rows[0].refresh_token_hash).toBe(hashToken(pair.refreshToken));
  });

  it('accepts newly issued tokens after a password change within the same JWT second', async () => {
    createSession();
    const fixed = Math.floor(Date.now() / 1000) * 1000 + 500;
    const now = vi.spyOn(Date, 'now').mockReturnValue(fixed - 1);
    try {
      const oldToken = signToken(state.rows[0].id, 'user', '15m');
      state.rows[0].password_changed_at = new Date(fixed).toISOString();
      now.mockReturnValue(fixed);
      const fresh = generateTokenPair(state.rows[0].id, 'user');
      const response = await fetch(`${base}/identity`, { headers: { Authorization: `Bearer ${fresh.accessToken}` } });
      expect(response.status).toBe(200);
      expect(verifyJWT(fresh.accessToken).iat * 1000).toBeLessThan(fixed);
      const stale = await fetch(`${base}/identity`, { headers: { Authorization: `Bearer ${oldToken}` } });
      expect(stale.status).toBe(401);
    } finally { now.mockRestore(); }
  });

  it('does not revoke a newer session when logout presents a stale cookie', async () => {
    const old = createSession();
    const newer = generateTokenPair(state.rows[0].id, 'user');
    state.rows[0].refresh_token_hash = hashToken(newer.refreshToken);
    const logout = await request('/logout', {}, cookie(old.refreshToken));
    expect(logout.status).toBe(409);
    expect(logout.body.code).toBe('LOGOUT_SESSION_CHANGED');
    expect(logout.cookies).toEqual([]);
    expect(state.rows[0].refresh_token_hash).toBe(hashToken(newer.refreshToken));
    expect((await request('/refresh', {}, cookie(newer.refreshToken))).status).toBe(200);
  });

  it('reports a logout conflict without clearing cookies when an overlapping refresh wins', async () => {
    const pair = createSession();
    let releaseRotation; let releaseRevocation; let rotationEntered; let revocationEntered;
    const rotationAllowed = new Promise(resolve => { releaseRotation = resolve; });
    const revocationAllowed = new Promise(resolve => { releaseRevocation = resolve; });
    const rotating = new Promise(resolve => { rotationEntered = resolve; });
    const revoking = new Promise(resolve => { revocationEntered = resolve; });
    state.writeGate = async payload => {
      if (payload.refresh_token_hash === null) { revocationEntered(); await revocationAllowed; }
      else { rotationEntered(); await rotationAllowed; }
    };
    const refresh = request('/refresh', {}, cookie(pair.refreshToken));
    await rotating;
    const logout = request('/logout', {}, cookie(pair.refreshToken));
    await revoking;
    releaseRotation();
    const refreshed = await refresh;
    expect(refreshed.status).toBe(200);
    const token = responseRefresh(refreshed);
    releaseRevocation();
    const conflict = await logout;
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('LOGOUT_SESSION_CHANGED');
    expect(conflict.cookies).toEqual([]);
    expect(state.rows[0].refresh_token_hash).toBe(hashToken(token));
    state.writeGate = null;
    expect((await request('/logout', {}, cookie(token))).status).toBe(200);
    expect(state.rows[0].refresh_token_hash).toBeNull();
  });

  it('a refresh paused behind successful logout cannot restore the revoked session', async () => {
    const pair = createSession();
    let releaseRotation; let rotationEntered;
    const allowed = new Promise(resolve => { releaseRotation = resolve; });
    const entered = new Promise(resolve => { rotationEntered = resolve; });
    state.writeGate = async payload => {
      if (payload.refresh_token_hash !== null) { rotationEntered(); await allowed; }
    };
    const refresh = request('/refresh', {}, cookie(pair.refreshToken));
    await entered;
    const logout = await request('/logout', {}, cookie(pair.refreshToken));
    expect(logout.status).toBe(200);
    expect(state.rows[0].refresh_token_hash).toBeNull();
    releaseRotation();
    const denied = await refresh;
    expect(denied.status).toBe(401);
    expect(denied.cookies).toEqual([]);
    expect(state.rows[0].refresh_token_hash).toBeNull();
  });

  it('allows idempotent local cleanup for missing or malformed refresh cookies', async () => {
    createSession();
    const original = state.rows[0].refresh_token_hash;
    expect((await request('/logout', {})).status).toBe(200);
    const malformed = await request('/logout', {}, cookie('not-a-jwt'));
    expect(malformed.status).toBe(200);
    expect(malformed.cookies.some(value => value.startsWith('refresh_token='))).toBe(true);
    expect(state.rows[0].refresh_token_hash).toBe(original);
    expect(state.calls).toHaveLength(0);
  });

  it('reports a failed logout write, preserves cookies for retry, and logs the failure', async () => {
    const pair = createSession();
    state.failWrites = true;
    const failed = await request('/logout', {}, cookie(pair.refreshToken));
    expect(failed.status).toBe(503);
    expect(failed.body.message).toMatch(/revoke.*session/i);
    expect(failed.cookies).toEqual([]);
    expect(state.rows[0].refresh_token_hash).toBe(hashToken(pair.refreshToken));
    expect(logger.error).toHaveBeenCalledWith('Logout: refresh-token invalidation failed', expect.objectContaining({ userId: state.rows[0].id }));
    state.failWrites = false;
    expect((await request('/logout', {}, cookie(pair.refreshToken))).status).toBe(200);
    expect(state.rows[0].refresh_token_hash).toBeNull();
  });

  it('computes refresh cookie and database expiry at issuance after a long-running process', async () => {
    const pair = createSession();
    const future = Date.now() + 10 * 24 * 60 * 60 * 1000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(future);
    try {
      const response = await request('/refresh', {}, cookie(pair.refreshToken));
      expect(response.status).toBe(200);
      const token = responseRefresh(response);
      const expected = verifyJWT(token, 'refresh').exp * 1000;
      expect(new Date(state.rows[0].refresh_token_expires).getTime()).toBe(expected);
      const header = response.cookies.find(value => value.startsWith('refresh_token='));
      const cookieExpiry = new Date(header.match(/Expires=([^;]+)/)[1]).getTime();
      expect(cookieExpiry).toBe(expected);
      expect(expected - future).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    } finally { now.mockRestore(); }
  });
});
