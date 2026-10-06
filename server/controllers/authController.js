// server/controllers/authController.js
import rateLimit from "express-rate-limit";
import asyncHandler from "express-async-handler";
import crypto from "crypto";

import {
  verifyJWT,
  generateTokenPair,
  hashToken,
  assignEmailVerificationToUser,
  assignPasswordResetToUser,
  generate2FASecret,
  verify2FAToken,
  verifyEmailToken,
  verifyPasswordResetToken,
} from "../utils/generateToken.js";

import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  comparePassword,
} from "../models/User.js";

import Email from "../utils/email.js";
import AppError from "../utils/appError.js";
import { logger } from "../middleware/logger.js";
import { buildCsrfToken } from "../utils/csrf.js";
import { getAuthClient } from "../config/db.js";
import { skipRateLimit } from "../config/rateLimit.js";
import { publicUser } from "../utils/publicUser.js";
import { authActionUrl } from "../utils/authActionUrl.js";

/* ===========================================================
   RATE LIMITING
=========================================================== */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  message: "Too many login attempts, please try again later",
});

/* ===========================================================
   COOKIE OPTIONS
=========================================================== */
const refreshCookieOptions = {
  expires: new Date(
    Date.now() +
      Number(process.env.JWT_REFRESH_COOKIE_EXPIRES_IN || 30) * 24 * 60 * 60 * 1000
  ),
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
};

/* ===========================================================
   HELPERS
=========================================================== */
const validatePasswordConfirm = (password, passwordConfirm) => {
  if (!password || !passwordConfirm) {
    throw new AppError("Password and passwordConfirm are required", 400);
  }
  if (password !== passwordConfirm) {
    throw new AppError("Passwords do not match", 400);
  }
};

const createSendToken = async (user, statusCode, res, client) => {
  const { accessToken, refreshToken } = generateTokenPair(user.id, user.role);
  const refreshTokenHash = hashToken(refreshToken);
  const refreshTokenExpires = new Date(refreshCookieOptions.expires).toISOString();
  await updateUser(user.id, {
    refreshTokenHash,
    refreshTokenExpires,
  }, client);

  res.cookie("refresh_token", refreshToken, refreshCookieOptions);
  res.cookie("csrf_token", buildCsrfToken(`refresh:${refreshToken}`), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  const safeUser = publicUser(user);

  res.status(statusCode).json({
    success: true,
    status: "success",
    token: accessToken,
    accessToken,
    data: { user: safeUser },
  });

  logger.info("Auth token issued", {
    userId: user.id,
    role: user.role,
  });
};

/* ===========================================================
   SIGNUP
   @desc   REGISTER NEW USER
   @route  POST /api/auth/signup
   @access Public
=========================================================== */
export const signup = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  logger.info("Signup start", { email: req.body?.email });

  const { name, email, password, passwordConfirm } = req.body;
  validatePasswordConfirm(password, passwordConfirm);

  // Create user in Supabase
  const newUser = await createUser({
    name,
    email,
    password,
    isEmailVerified: false,
  }, supabase);

  // Assign token & store hashed token in DB
  const verificationToken = await assignEmailVerificationToUser(newUser.id, supabase);

  try {
    const verificationUrl = authActionUrl("verify-email", verificationToken);

    await new Email(newUser, verificationUrl).sendWelcome({ verifyEmail: true });

    res.status(201).json({
      status: "success",
      message:
        "User registered successfully. Please check your email to verify your account.",
      data: { user: publicUser(newUser) },
    });

    logger.info("Signup success (verification email sent)", {
      userId: newUser.id,
    });
  } catch (err) {
    // Reset token fields if email fails
    await updateUser(newUser.id, {
      emailVerificationToken: null,
      emailVerificationExpires: null,
    }, supabase);

    logger.error("Email send failure at signup", {
      error: err.message,
      userId: newUser.id,
    });

    return next(new AppError("Error sending email", 500));
  }
});

/* ===========================================================
   VERIFY EMAIL
   @desc   VERIFY USER EMAIL
   @route  GET /api/auth/verify-email/:token
   @access Public
=========================================================== */
export const verifyEmail = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  logger.info("Verify email start");

  const user = await verifyEmailToken(req.params.token, supabase);
  if (user.active === false) return next(new AppError("Account disabled. Contact support.", 403));

  const verifiedUser = await updateUser(user.id, {
    isEmailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
  }, supabase);

  await createSendToken(verifiedUser, 200, res, supabase);

  logger.info("Email verified", { userId: user.id });
});

/* ===========================================================
   LOGIN
   @desc   LOGIN USER
   @route  POST /api/auth/login
   @access Public
=========================================================== */
export const login = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  logger.info("Login attempt", { email: req.body?.email });

  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }

  const user = await findUserByEmail(email, { includePassword: true }, supabase);

  if (!user || !(await comparePassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  if (user.active === false) return next(new AppError("Account disabled. Contact support.", 403));

  if (!user.isEmailVerified) {
    return next(new AppError("Please verify your email first", 401));
  }

  // 2FA check
  if (user.twoFactorEnabled) {
    const twoFactorToken =
      req.body.twoFactorToken || req.headers["x-2fa-token"];

    if (!twoFactorToken) {
      return next(
        new AppError(
          "Two-factor authentication token is required for this account",
          401
        )
      );
    }

    const verified = verify2FAToken(user.twoFactorSecret, twoFactorToken);
    if (!verified) {
      return next(new AppError("Invalid two-factor authentication token", 401));
    }
  }

  await createSendToken(user, 200, res, supabase);

  logger.info("Login success", { userId: user.id });
});

/* ===========================================================
   LOGOUT
   @desc   LOGOUT USER
   @route  GET /api/auth/logout
   @access Private
=========================================================== */
export const logout = (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (req.user?.id) {
    updateUser(req.user.id, {
      refreshTokenHash: null,
      refreshTokenExpires: null,
    }, getAuthClient()).catch(() => {});
  } else if (refreshToken) {
    try {
      const decoded = verifyJWT(refreshToken);
      updateUser(decoded.userId, {
        refreshTokenHash: null,
        refreshTokenExpires: null,
      }, getAuthClient()).catch(() => {});
    } catch {}
  }

  res.cookie("refresh_token", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.cookie("csrf_token", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(200).json({ status: "success" });

  try {
    logger.info("Logout", { userId: req.user?.id });
  } catch {}
};

/* ===========================================================
   FORGOT PASSWORD
   @desc   INITIATE PASSWORD RESET
   @route  POST /api/auth/forgot-password
   @access Public
=========================================================== */
export const forgotPassword = asyncHandler(async (req, res, next) => {
  logger.info("Forgot password start", { email: req.body?.email });

  const supabase = getAuthClient();
  const user = await findUserByEmail(req.body.email, {
    includePassword: false,
  }, supabase);

  if (!user) return next(new AppError("No user with that email", 404));

  const resetToken = await assignPasswordResetToUser(user.id, supabase);

  try {
    const resetURL = authActionUrl("reset-password", resetToken);

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: "success",
      message: "Password reset token sent to email",
    });

    logger.info("Password reset token sent", { userId: user.id });
  } catch (err) {
    await updateUser(user.id, {
      passwordResetToken: null,
      passwordResetExpires: null,
    }, supabase);

    logger.error("Forgot password email failed", {
      error: err.message,
      userId: user.id,
    });

    return next(new AppError("Error sending email", 500));
  }
});

/* ===========================================================
   RESET PASSWORD
   @desc   RESET USER PASSWORD
   @route  POST /api/auth/reset-password/:token
   @access Public
=========================================================== */
export const resetPassword = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  logger.info("Reset password start");

  const user = await verifyPasswordResetToken(req.params.token, supabase);

  validatePasswordConfirm(req.body.password, req.body.passwordConfirm);

  await updateUser(user.id, {
    password: req.body.password,
    passwordChangedAt: new Date().toISOString(),
    passwordResetToken: null,
    passwordResetExpires: null,
  }, supabase);

  const updatedUser = await findUserById(user.id, {}, supabase);
  await createSendToken(updatedUser, 200, res, supabase);

  logger.info("Password reset", { userId: user.id });
});

/* ===========================================================
   UPDATE PASSWORD (LOGGED IN)
   @desc   UPDATE CURRENT USER PASSWORD
   @route  PATCH /api/auth/update-password
   @access Private
=========================================================== */
export const updatePassword = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  logger.info("Update password start", { userId: req.user.id });

  const { passwordCurrent, password, passwordConfirm } = req.body;

  if (!passwordCurrent || !password || !passwordConfirm) {
    return next(
      new AppError(
        "Please provide current password, new password and passwordConfirm",
        400
      )
    );
  }

  const user = await findUserById(req.user.id, { includePassword: true }, supabase);

  if (!user) return next(new AppError("User not found", 404));

  if (!(await comparePassword(passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }

  validatePasswordConfirm(password, passwordConfirm);

  await updateUser(user.id, {
    password,
    passwordChangedAt: new Date().toISOString(),
  }, supabase);

  const updatedUser = await findUserById(user.id, {}, supabase);
  await createSendToken(updatedUser, 200, res, supabase);

  logger.info("Password updated", { userId: user.id });
});

/* ===========================================================
   ENABLE 2FA
   @desc   ENABLE TWO-FACTOR AUTHENTICATION
   @route  POST /api/auth/2fa/enable
   @access Private
=========================================================== */
export const enableTwoFactor = asyncHandler(async (req, res, next) => {
  if (req.user.twoFactorEnabled) {
    return next(new AppError("Disable existing two-factor authentication before setting it up again.", 409));
  }
  const supabase = getAuthClient();
  logger.info("Enable 2FA start", { userId: req.user.id });

  const { password } = req.body;

  if (!password) {
    return next(
      new AppError(
        "Password is required to enable two-factor authentication",
        400
      )
    );
  }

  const user = await findUserById(req.user.id, { includePassword: true }, supabase);

  if (!user) return next(new AppError("User not found", 404));

  if (!(await comparePassword(password, user.password))) {
    return next(new AppError("Incorrect password", 401));
  }

  const secret = generate2FASecret(user.email);

  await updateUser(user.id, {
    twoFactorSecret: secret.base32,
    twoFactorEnabled: false,
  }, supabase);

  res.status(200).json({
    status: "success",
    data: {
      otpauthUrl: secret.otpauth_url,
      secret: secret.base32,
    },
  });

  logger.info("2FA secret issued", { userId: user.id });
});

/* ===========================================================
   DISABLE 2FA
   @desc   DISABLE TWO-FACTOR AUTHENTICATION
   @route  POST /api/auth/2fa/disable
   @access Private
=========================================================== */
export const disableTwoFactor = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  logger.info("Disable 2FA start", { userId: req.user.id });

  const { password, token } = req.body;

  if (!password || !token) {
    return next(
      new AppError(
        "Password and two-factor token are required to disable 2FA",
        400
      )
    );
  }

  const user = await findUserById(req.user.id, {
    includePassword: true,
  }, supabase);

  if (!user) return next(new AppError("User not found", 404));

  if (!(await comparePassword(password, user.password))) {
    return next(new AppError("Incorrect password", 401));
  }

  const verified = verify2FAToken(user.twoFactorSecret, token);
  if (!verified) {
    return next(new AppError("Invalid verification code", 400));
  }

  await updateUser(user.id, {
    twoFactorEnabled: false,
    twoFactorSecret: null,
  }, supabase);

  res.status(200).json({
    status: "success",
    message: "Two-factor authentication disabled successfully",
  });

  logger.info("2FA disabled", { userId: user.id });
});

/* ===========================================================
   VERIFY 2FA SETUP
   @desc   VERIFY TWO-FACTOR AUTHENTICATION SETUP
   @route  POST /api/auth/2fa/verify
   @access Private
=========================================================== */
export const verifyTwoFactor = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  logger.info("Verify 2FA start", { userId: req.user.id });

  const { token } = req.body;

  if (!token) {
    return next(new AppError("Verification token is required", 400));
  }

  const user = await findUserById(req.user.id, {
    includePassword: false,
  }, supabase);

  if (!user.twoFactorSecret) {
    return next(new AppError("2FA is not initialized for this user", 400));
  }

  const verified = verify2FAToken(user.twoFactorSecret, token);
  if (!verified) {
    return next(new AppError("Invalid verification code", 400));
  }

  await updateUser(user.id, {
    twoFactorEnabled: true,
  }, supabase);

  res.status(200).json({
    status: "success",
    message: "Two-factor authentication enabled successfully",
  });

  logger.info("2FA enabled", { userId: user.id });
});

/* ===========================================================
   REFRESH TOKEN
   @desc   REFRESH JWT TOKEN
   @route  POST /api/auth/refresh
   @access Private
=========================================================== */
export const refreshToken = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  const presentedRefreshToken = req.cookies?.refresh_token;
  if (!presentedRefreshToken) {
    return next(new AppError("Refresh token is missing", 401));
  }

  let decoded;
  try {
    decoded = verifyJWT(presentedRefreshToken);
  } catch (err) {
    return next(new AppError("Invalid or expired refresh token", 401));
  }

  const user = await findUserById(decoded.userId, { includePassword: false }, supabase);
  if (!user || !user.active) {
    return next(new AppError("User not found or inactive", 401));
  }

  if (!user.refreshTokenHash || !user.refreshTokenExpires) {
    return next(new AppError("Refresh session not found", 401));
  }

  const presentedHash = hashToken(presentedRefreshToken);
  if (presentedHash !== user.refreshTokenHash) {
    return next(new AppError("Refresh token mismatch", 401));
  }

  if (new Date(user.refreshTokenExpires).getTime() < Date.now()) {
    return next(new AppError("Refresh token expired", 401));
  }

  await createSendToken(user, 200, res, supabase);
  logger.info("Token rotated", { userId: user.id });
});

export const csrfToken = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  let anonSession = req.cookies?.anon_session;
  if (!anonSession && !req.cookies?.refresh_token) {
    anonSession = crypto.randomBytes(16).toString("hex");
    res.cookie("anon_session", anonSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
  }

  const binding = req.cookies?.refresh_token
    ? `refresh:${req.cookies.refresh_token}`
    : `anon:${anonSession}`;
  const token = buildCsrfToken(binding);
  res.cookie("csrf_token", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.status(200).json({
    success: true,
    data: { csrfToken: token },
  });
});

/* ===========================================================
   SEND VERIFICATION EMAIL
   @desc   RESEND EMAIL VERIFICATION
   @route  POST /api/auth/send-verification-email
   @access Private
=========================================================== */
// Password proof permits email recovery without issuing an unverified session.
export const resendVerification = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  const user = await findUserByEmail(req.body.email, { includePassword: true }, supabase);
  if (!user || !(await comparePassword(req.body.password, user.password)) || user.active === false) {
    return next(new AppError('Incorrect email or password', 401));
  }
  if (user.isEmailVerified) {
    return res.json({ success: true, data: { message: 'Your email is already verified. You can sign in.' } });
  }
  const token = await assignEmailVerificationToUser(user.id, supabase);
  try {
    await new Email(user, authActionUrl('verify-email', token)).sendVerificationEmail();
  } catch (error) {
    // Do not clear a token that a concurrent resend may have just replaced.
    logger.error('Verification recovery email failed', { userId: user.id, code: error.code || 'MAIL_FAILURE' });
    return next(new AppError('Unable to send verification email. Please try again later.', 503));
  }
  res.json({ success: true, data: { message: 'Verification email sent. Open the newest link in your inbox or spam folder.' } });
});

export const sendVerificationEmail = asyncHandler(async (req, res, next) => {
  const supabase = getAuthClient();
  logger.info("Send verification email request", { userId: req.user?.id });

  const user = await findUserById(req.user.id, {}, supabase);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (user.isEmailVerified) {
    return next(new AppError("Email already verified", 400));
  }

  const verificationToken = await assignEmailVerificationToUser(user.id, supabase);

  try {
    const verificationUrl = authActionUrl("verify-email", verificationToken);

    await new Email(user, verificationUrl).sendVerificationEmail();

    res.status(200).json({
      status: "success",
      message: "Verification email sent successfully",
    });

    logger.info("Verification email sent", { userId: user.id });
  } catch (err) {
    await updateUser(user.id, {
      emailVerificationToken: null,
      emailVerificationExpires: null,
    }, supabase);

    logger.error("Email send failure", {
      error: err.message,
      userId: user.id,
    });

    return next(new AppError("Error sending email", 500));
  }
});
