import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
const state = vi.hoisted(() => ({ clients: [] }));
vi.mock('@supabase/supabase-js', () => ({ createClient: (url, key, options) => {
  const client = { url, key, options }; state.clients.push(client); return client;
} }));
import { bindDatabaseIdentity, getSupabaseClient } from '../../config/db.js';
const id = '10000000-0000-4000-8000-000000000001';
afterEach(() => vi.unstubAllEnvs());
describe('Supabase identity bridge', () => {
  it('ignores unverified bearer tokens, body identities and req.user', () => {
    const client = getSupabaseClient({ headers: { authorization: 'Bearer forged' }, user: { id }, body: { id } });
    expect(client.key).toBe('test-anon-key');
    expect(client.options.global).toBeUndefined();
  });
  it('maps only the middleware-bound identity to a short-lived authenticated JWT', () => {
    const req = { headers: { authorization: 'Bearer application-jwt' }, user: { id, role: 'admin' } };
    bindDatabaseIdentity(req, id);
    const client = getSupabaseClient(req);
    expect(client.key).toBe('test-anon-key');
    const token = client.options.global.headers.Authorization.slice(7);
    const claims = jwt.verify(token, process.env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'], audience: 'authenticated' });
    expect(claims.sub).toBe(id);
    expect(claims.role).toBe('authenticated');
    expect(claims.exp - claims.iat).toBe(60);
    expect(claims).not.toHaveProperty('password');
    expect(getSupabaseClient({ ...req }).options.global).toBeUndefined();
  });
  it('fails closed without signing configuration and rejects invalid subject IDs', () => {
    const req = {}; bindDatabaseIdentity(req, id);
    vi.stubEnv('SUPABASE_JWT_SECRET', '');
    expect(() => getSupabaseClient(req)).toThrow(/SUPABASE_JWT_SECRET/);
    expect(() => bindDatabaseIdentity({}, 'admin')).toThrow(/Invalid database user identity/);
  });
});
