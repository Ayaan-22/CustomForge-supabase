// server/utils/generateToken.js
import jwt from "jsonwebtoken";
import AppError from "./appError.js";
import crypto from "crypto";
import speakeasy from "speakeasy";
import dotenv from "dotenv";
import { supabase } from "../config/db.js";
import { updateUser, findUserById } from "../models/User.js";

dotenv.config();

// Validate environment variables
if (!process.env.JWT_SECRET) {
  throw AppError.internal("JWT_SECRET is not defined in environment variables");
}

// Configuration constants
const JWT_CONFIG = {
  algorithm: process.env.JWT_ALGORITHM || "HS256",
  expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  shortExpires: process.env.JWT_SHORT_EXPIRES_IN || "15m",
  refreshExpires:
    process.env.JWT_REFRESH_EXPIRES_IN ||
    process.env.JWT_EXPIRES_IN ||
    "30d",
};

const TOKEN_EXPIRY = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET: 10 * 60 * 1000, // 10 minutes
};

// Core JWT Functions
export const signToken = (userId, role = "user", expiresIn = null) => {
  try {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
      algorithm: JWT_CONFIG.algorithm,
      expiresIn: expiresIn || JWT_CONFIG.expiresIn,
    });
  } catch (err) {
    throw AppError.internal("Failed to sign JWT", {
      originalError: err.message,
    });
  }
};

export const verifyJWT = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [JWT_CONFIG.algorithm],
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw AppError.unauthorized("Token has expired", {
        expiredAt: err.expiredAt,
      });
    }
    throw AppError.unauthorized("Invalid token", { reason: err.message });
  }
};

const generateGenericToken = (expiryMs) => {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    hashedToken: crypto.createHash("sha256").update(token).digest("hex"),
    expires: Date.now() + expiryMs,
  };
};

export const generateEmailVerificationToken = () =>
  generateGenericToken(TOKEN_EXPIRY.EMAIL_VERIFICATION);

export const generatePasswordResetToken = () =>
  generateGenericToken(TOKEN_EXPIRY.PASSWORD_RESET);

// Token Hashing Utility
export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// Token Verification Utility
export const verifyTokenAndFindUser = async (
  token,
  tokenField,
  expiresField
) => {
  const hashedToken = hashToken(token);
  const now = new Date().toISOString();

  // Map camelCase to snake_case for database fields
  const dbTokenField = tokenField === "emailVerificationToken" 
    ? "email_verification_token"
    : "password_reset_token";
  const dbExpiresField = expiresField === "emailVerificationExpires"
    ? "email_verification_expires"
    : "password_reset_expires";

  // First find user by token
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq(dbTokenField, hashedToken)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to verify token", 500);
  }

  if (!user) {
    throw new AppError("Token is invalid or has expired", 400);
  }

  // Check expiration (stored as ISO string, compare as timestamps)
  const expiresAt = user[dbExpiresField];
  if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
    throw new AppError("Token is invalid or has expired", 400);
  }

  return user;
};

// Specific token verification functions
export const verifyEmailToken = async (token) => {
  const user = await verifyTokenAndFindUser(
    token,
    "emailVerificationToken",
    "emailVerificationExpires"
  );
  // Map the user row to camelCase format
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    phone: user.phone,
    address: user.address,
    isEmailVerified: user.is_email_verified,
    emailVerificationToken: user.email_verification_token,
    emailVerificationExpires: user.email_verification_expires,
    passwordResetToken: user.password_reset_token,
    passwordResetExpires: user.password_reset_expires,
    passwordChangedAt: user.password_changed_at,
    twoFactorEnabled: user.two_factor_enabled,
    twoFactorSecret: user.two_factor_secret,
    active: user.active,
    stripeCustomerId: user.stripe_customer_id,
    paymentMethods: user.payment_methods,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};

export const verifyPasswordResetToken = async (token) => {
  const user = await verifyTokenAndFindUser(
    token,
    "passwordResetToken",
    "passwordResetExpires"
  );
  // Map the user row to camelCase format
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    phone: user.phone,
    address: user.address,
    isEmailVerified: user.is_email_verified,
    emailVerificationToken: user.email_verification_token,
    emailVerificationExpires: user.email_verification_expires,
    passwordResetToken: user.password_reset_token,
    passwordResetExpires: user.password_reset_expires,
    passwordChangedAt: user.password_changed_at,
    twoFactorEnabled: user.two_factor_enabled,
    twoFactorSecret: user.two_factor_secret,
    active: user.active,
    stripeCustomerId: user.stripe_customer_id,
    paymentMethods: user.payment_methods,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};

// Two-Factor Authentication
export const generate2FASecret = (email) => {
  return speakeasy.generateSecret({
    name: `GameShop (${email})`,
    length: 20,
  });
};

export const verify2FAToken = (secret, token) => {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 2,
  });
};

// Token Pair Generation
export const generateTokenPair = (userId, role) => {
  return {
    accessToken: signToken(userId, role, JWT_CONFIG.shortExpires),
    refreshToken: signToken(userId, role, JWT_CONFIG.refreshExpires),
  };
};

// User Model Helpers
export const assignEmailVerificationToUser = async (userId) => {
  const { token, hashedToken, expires } = generateEmailVerificationToken();
  
  await updateUser(userId, {
    emailVerificationToken: hashedToken,
    emailVerificationExpires: new Date(expires).toISOString(),
  });
  
  return token;
};

export const assignPasswordResetToUser = async (userId) => {
  const { token, hashedToken, expires } = generatePasswordResetToken();
  
  await updateUser(userId, {
    passwordResetToken: hashedToken,
    passwordResetExpires: new Date(expires).toISOString(),
  });
  
  return token;
};

export default {
  signToken,
  verifyJWT,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  generate2FASecret,
  verify2FAToken,
  generateTokenPair,
  assignEmailVerificationToUser,
  assignPasswordResetToUser,
  hashToken,
  verifyTokenAndFindUser,
  verifyEmailToken,
  verifyPasswordResetToken,
};
