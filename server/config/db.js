// server/config/db.js
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import {
  inRequestContext,
  getRequestPath,
  getRequestMethod,
} from "../utils/requestContext.js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  const missing = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
  if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  console.error(`❌ Missing Supabase environment variables: ${missing.join(", ")}`);
  throw new Error(`Missing Supabase environment variables: ${missing.join(", ")}`);
}

let anonClientSingleton = null;
const verifiedIdentities = new WeakMap();

// Called only after middleware verifies the app JWT and checks the stored user.
// Never infer database identity from a client-supplied header or req.body.
export const bindDatabaseIdentity = (req, userId) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Invalid database user identity");
  }
  verifiedIdentities.set(req, userId);
};

const SERVICE_ALLOWED_PREFIXES = ["/api/v1/admin"];
const SERVICE_ALLOWED_EXACT = ["/api/v1/payment/webhook"];

const canUseServiceInRequest = (path = "") =>
  SERVICE_ALLOWED_EXACT.includes(path) ||
  SERVICE_ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const createRawServiceClient = () =>
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

// Custom authentication must read password/token hashes before a caller has a
// database identity. This server-only capability exposes users CRUD required by
// authentication, not a general service client (no RPC, schema, storage or auth).
// Only authController and JWT-verifying authMiddleware may consume it.
export const getAuthClient = () => {
  const client = createRawServiceClient();
  return Object.freeze({
    from(table) {
      if (table !== "users") throw new Error("Auth client can only access users");
      const relation = client.from("users");
      return Object.freeze({
        select: (...args) => relation.select(...args),
        insert: (...args) => relation.insert(...args),
        update: (...args) => relation.update(...args),
      });
    },
  });
};

export const getServiceClient = () => {
  const client = createRawServiceClient();

  if (process.env.NODE_ENV === "production") {
    return client;
  }

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (inRequestContext()) {
        const requestPath = getRequestPath() || "";
        if (!canUseServiceInRequest(requestPath)) {
          throw new Error(
            `Service-role client used in request context (${getRequestMethod()} ${requestPath}). This bypasses RLS and is forbidden.`
          );
        }
      }

      return Reflect.get(target, prop, receiver);
    },
  });
};

export const getSupabaseClient = (req) => {
  const userId = req ? verifiedIdentities.get(req) : null;

  if (!userId) {
    if (!anonClientSingleton) {
      anonClientSingleton = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    return anonClientSingleton;
  }

  // App JWTs have their own issuer/key and must not be sent to PostgREST.
  // Mint a short-lived database-only JWT with the normal authenticated role.
  // Even application admins receive owner-scoped RLS here, never service_role.
  const signingSecret = process.env.SUPABASE_JWT_SECRET;
  if (!signingSecret) throw new Error("SUPABASE_JWT_SECRET is required for authenticated database access");
  const token = jwt.sign({ role: "authenticated" }, signingSecret, {
    algorithm: "HS256", subject: userId, audience: "authenticated",
    issuer: `${supabaseUrl}/auth/v1`, expiresIn: 60,
  });

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const getAnonClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

console.log("📦 Supabase clients initialized (anon + service)");
