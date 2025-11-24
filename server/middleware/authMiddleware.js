// server/middleware/authMiddleware.js
import asyncHandler from "express-async-handler";
import AppError from "../utils/appError.js";
import { logger } from "./logger.js";
import { verify2FAToken, verifyJWT } from "../utils/generateToken.js";
import { findUserById } from "../models/User.js";

/* =======================================================================================
   PROTECT – Authenticates user using JWT
   ======================================================================================= */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    logger.warn("Unauthorized access attempt - no token", {
      route: req.originalUrl,
      ip: req.ip,
    });
    return next(new AppError("Not logged in.", 401));
  }

  // Verify JWT
  let decoded;
  try {
    decoded = verifyJWT(token);
  } catch (err) {
    logger.error(`JWT verification failed: ${err.message}`);
    return next(new AppError("Invalid or expired token.", 401));
  }

  // Get user from Supabase using User model (returns camelCase)
  const currentUser = await findUserById(decoded.userId);

  if (!currentUser) {
    logger.warn("Token used for non-existing user", { userId: decoded.userId });
    return next(new AppError("User no longer exists.", 401));
  }

  if (currentUser.active === false) {
    logger.warn("Inactive user attempted access");
    return next(new AppError("Account disabled. Contact support.", 403));
  }

  // If password changed after token was issued
  if (
    currentUser.passwordChangedAt &&
    decoded.iat * 1000 < new Date(currentUser.passwordChangedAt).getTime()
  ) {
    return next(
      new AppError("Password recently changed. Login again.", 401)
    );
  }

  req.user = currentUser;
  res.locals.user = currentUser;

  next();
});

/* =======================================================================================
   RESTRICT-TO – Authorize based on role
   ======================================================================================= */
export const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return next(new AppError("Not authenticated", 401));

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn("Unauthorized role access");
      return next(
        new AppError("You do not have permission.", 403)
      );
    }

    next();
  };
};

/* =======================================================================================
   VERIFIED EMAIL
   ======================================================================================= */
export const verifiedEmail = asyncHandler(async (req, res, next) => {
  if (!req.user?.isEmailVerified) {
    return next(new AppError("Please verify your email first.", 403));
  }
  next();
});

/* =======================================================================================
   TWO-FACTOR AUTH (uses Supabase user data)
   ======================================================================================= */
export const twoFactorAuth = asyncHandler(async (req, res, next) => {
  if (!req.user?.twoFactorEnabled || !req.user.twoFactorSecret) {
    return next();
  }

  const twoFactorToken =
    req.headers["x-2fa-token"] || req.body.twoFactorToken;

  if (!twoFactorToken) {
    return next(new AppError("2FA token required.", 401));
  }

  const verified = verify2FAToken(req.user.twoFactorSecret, twoFactorToken);

  if (!verified) return next(new AppError("Invalid 2FA token.", 401));

  next();
});
