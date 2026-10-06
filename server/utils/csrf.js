import crypto from "crypto";

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || "csrf-dev-secret";

export const buildCsrfToken = (binding) =>
  crypto.createHmac("sha256", CSRF_SECRET).update(String(binding)).digest("hex");

export const getCsrfBindingFromRequest = (req) => {
  if (req.cookies?.refresh_token) return `refresh:${req.cookies.refresh_token}`;
  if (req.cookies?.anon_session) return `anon:${req.cookies.anon_session}`;
  return null;
};

