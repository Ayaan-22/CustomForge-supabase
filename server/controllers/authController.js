// server/controllers/authController.js
import rateLimit from "express-rate-limit";
import asyncHandler from "express-async-handler";

import {
  signToken,
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

/* ===========================================================
   RATE LIMITING
=========================================================== */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts, please try again later",
});

/* ===========================================================
   COOKIE OPTIONS
=========================================================== */
const cookieOptions = {
  expires: new Date(
    Date.now() +
      (Number(process.env.JWT_COOKIE_EXPIRES_IN || 7) *
        24 *
        60 *
        60 *
        1000)
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

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id, user.role);

  res.cookie("jwt", token, cookieOptions);

  const safeUser = { ...user };
  delete safeUser.password;

  res.status(statusCode).json({
    success: true,
    status: "success",
    token,
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
  logger.info("Signup start", { email: req.body?.email });

  const { name, email, password, passwordConfirm } = req.body;
  validatePasswordConfirm(password, passwordConfirm);

  // Create user in Supabase
  const newUser = await createUser({
    name,
    email,
    password,
    isEmailVerified: false,
  });

  // Assign token & store hashed token in DB
  const verificationToken = await assignEmailVerificationToUser(newUser.id);

  try {
    const verificationUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/auth/verify-email/${verificationToken}`;

    await new Email(newUser, verificationUrl).sendWelcome();

    res.status(201).json({
      status: "success",
      message:
        "User registered successfully. Please check your email to verify your account.",
      data: { user: newUser },
    });

    logger.info("Signup success (verification email sent)", {
      userId: newUser.id,
    });
  } catch (err) {
    // Reset token fields if email fails
    await updateUser(newUser.id, {
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

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
  logger.info("Verify email start");

  const user = await verifyEmailToken(req.params.token);

  await updateUser(user.id, {
    isEmailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
  });

  createSendToken(user, 200, res);

  logger.info("Email verified", { userId: user.id });
});

/* ===========================================================
   LOGIN
   @desc   LOGIN USER
   @route  POST /api/auth/login
   @access Public
=========================================================== */
export const login = asyncHandler(async (req, res, next) => {
  logger.info("Login attempt", { email: req.body?.email });

  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }

  const user = await findUserByEmail(email, { includePassword: true });

  if (!user || !(await comparePassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

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

  createSendToken(user, 200, res);

  logger.info("Login success", { userId: user.id });
});

/* ===========================================================
   LOGOUT
   @desc   LOGOUT USER
   @route  GET /api/auth/logout
   @access Private
=========================================================== */
export const logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
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

  const user = await findUserByEmail(req.body.email, {
    includePassword: false,
  });

  if (!user) return next(new AppError("No user with that email", 404));

  const resetToken = await assignPasswordResetToUser(user.id);

  try {
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/api/auth/reset-password/${resetToken}`;

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
    });

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
  logger.info("Reset password start");

  const user = await verifyPasswordResetToken(req.params.token);

  validatePasswordConfirm(req.body.password, req.body.passwordConfirm);

  await updateUser(user.id, {
    password: req.body.password,
    passwordChangedAt: new Date().toISOString(),
    passwordResetToken: null,
    passwordResetExpires: null,
  });

  const updatedUser = await findUserById(user.id);
  createSendToken(updatedUser, 200, res);

  logger.info("Password reset", { userId: user.id });
});

/* ===========================================================
   UPDATE PASSWORD (LOGGED IN)
   @desc   UPDATE CURRENT USER PASSWORD
   @route  PATCH /api/auth/update-password
   @access Private
=========================================================== */
export const updatePassword = asyncHandler(async (req, res, next) => {
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

  const user = await findUserById(req.user.id, { includePassword: true });

  if (!user) return next(new AppError("User not found", 404));

  if (!(await comparePassword(passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }

  validatePasswordConfirm(password, passwordConfirm);

  await updateUser(user.id, {
    password,
    passwordChangedAt: new Date().toISOString(),
  });

  const updatedUser = await findUserById(user.id);
  createSendToken(updatedUser, 200, res);

  logger.info("Password updated", { userId: user.id });
});

/* ===========================================================
   ENABLE 2FA
   @desc   ENABLE TWO-FACTOR AUTHENTICATION
   @route  POST /api/auth/2fa/enable
   @access Private
=========================================================== */
export const enableTwoFactor = asyncHandler(async (req, res, next) => {
  logger.info("Enable 2FA start", { userId: req.user.id });

  const { password } = req.body;

  if (!password) {
    return next(
      new AppError("Password is required to enable two-factor authentication", 400)
    );
  }

  const user = await findUserById(req.user.id, { includePassword: true });

  if (!user) return next(new AppError("User not found", 404));

  if (!(await comparePassword(password, user.password))) {
    return next(new AppError("Incorrect password", 401));
  }

  const secret = generate2FASecret(user.email);

  await updateUser(user.id, {
    twoFactorSecret: secret.base32,
    twoFactorEnabled: false,
  });

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
  });

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
  });

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
  logger.info("Verify 2FA start", { userId: req.user.id });

  const { token } = req.body;

  if (!token) {
    return next(new AppError("Verification token is required", 400));
  }

  const user = await findUserById(req.user.id, {
    includePassword: false,
  });

  if (!user.twoFactorSecret) {
    return next(new AppError("2FA is not initialized for this user", 400));
  }

  const verified = verify2FAToken(user.twoFactorSecret, token);
  if (!verified) {
    return next(new AppError("Invalid verification code", 400));
  }

  await updateUser(user.id, {
    twoFactorEnabled: true,
  });

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
  logger.info("Refresh token request", { userId: req.user?.id });

  if (!req.user) {
    return next(new AppError("Not authenticated", 401));
  }

  const user = await findUserById(req.user.id);
  if (!user || !user.active) {
    return next(new AppError("User not found or inactive", 401));
  }

  createSendToken(user, 200, res);
  logger.info("Token refreshed", { userId: user.id });
});

/* ===========================================================
   SEND VERIFICATION EMAIL
   @desc   RESEND EMAIL VERIFICATION
   @route  POST /api/auth/send-verification-email
   @access Private
=========================================================== */
export const sendVerificationEmail = asyncHandler(async (req, res, next) => {
  logger.info("Send verification email request", { userId: req.user?.id });

  const user = await findUserById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (user.isEmailVerified) {
    return next(new AppError("Email already verified", 400));
  }

  const verificationToken = await assignEmailVerificationToUser(user.id);

  try {
    const verificationUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/auth/verify-email/${verificationToken}`;

    await new Email(user, verificationUrl).sendWelcome();

    res.status(200).json({
      status: "success",
      message: "Verification email sent successfully",
    });

    logger.info("Verification email sent", { userId: user.id });
  } catch (err) {
    await updateUser(user.id, {
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    logger.error("Email send failure", {
      error: err.message,
      userId: user.id,
    });

    return next(new AppError("Error sending email", 500));
  }
});
