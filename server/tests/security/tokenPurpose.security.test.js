import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import * as OTPAuth from 'otpauth';
import { generateTokenPair, generate2FASecret, signToken, verifyJWT, verify2FAToken } from '../../utils/generateToken.js';

describe('application token purposes', () => {
  it('requires explicit expiry and rejects untyped legacy JWTs', () => {
    expect(() => signToken('user', 'user')).toThrow(/explicit expiry/);
    const legacy = jwt.sign({ userId: 'user', role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    expect(() => verifyJWT(legacy)).toThrow(/Invalid token/);
    expect(() => verifyJWT(legacy, 'refresh')).toThrow(/Invalid token/);
  });

  it('uses separate audiences and purposes, with distinct refresh IDs inside one second', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    try {
      const first = generateTokenPair('user', 'user');
      const second = generateTokenPair('user', 'user');
      expect(verifyJWT(first.accessToken).tokenUse).toBe('access');
      const refresh = verifyJWT(first.refreshToken, 'refresh');
      expect(refresh).toMatchObject({ tokenUse: 'refresh', aud: 'customforge-refresh', iss: 'customforge' });
      expect(refresh.exp - refresh.iat).toBe(30 * 24 * 60 * 60);
      expect(first.refreshToken).not.toBe(second.refreshToken);
      expect(refresh.jti).not.toBe(verifyJWT(second.refreshToken, 'refresh').jti);
      expect(() => verifyJWT(first.refreshToken)).toThrow(/Invalid token/);
      expect(() => verifyJWT(first.accessToken, 'refresh')).toThrow(/Invalid token/);
    } finally { now.mockRestore(); }
  });
});

describe('portable enrolled TOTP secrets', () => {
  it('matches the RFC 6238 SHA1 vector at the existing six-digit width', () => {
    // RFC 6238 Appendix B: SHA1 at 59s yields 94287082 (287082 at six digits).
    const now = vi.spyOn(Date, 'now').mockReturnValue(59_000);
    try {
      expect(verify2FAToken('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082')).toBe(true);
      expect(verify2FAToken('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '94287082')).toBe(false);
    } finally { now.mockRestore(); }
  });

  it('keeps existing SHA1, six-digit, 30-second secrets and the two-step window', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const timestamp = 1_800_000_000_000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(timestamp);
    try {
      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6, period: 30 });
      expect(verify2FAToken(secret, totp.generate({ timestamp }))).toBe(true);
      expect(verify2FAToken(secret, totp.generate({ timestamp: timestamp - 60_000 }))).toBe(true);
      expect(verify2FAToken(secret, totp.generate({ timestamp: timestamp + 60_000 }))).toBe(true);
      expect(verify2FAToken(secret, totp.generate({ timestamp: timestamp - 90_000 }))).toBe(false);
      expect(verify2FAToken(secret, 'invalid')).toBe(false);
      expect(verify2FAToken(null, '123456')).toBe(false);
    } finally { now.mockRestore(); }
  });

  it('preserves the enrollment response fields and GameShop label', () => {
    const generated = generate2FASecret('member@example.test');
    expect(generated.base32).toMatch(/^[A-Z2-7]+$/);
    const uri = new URL(generated.otpauth_url);
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.hostname).toBe('totp');
    expect(decodeURIComponent(uri.pathname)).toContain('GameShop (member@example.test)');
    expect(uri.searchParams.get('secret')).toBe(generated.base32);
    expect(OTPAuth.URI.parse(generated.otpauth_url).secret.base32).toBe(generated.base32);
  });
});
