// File: server/routes/emailTestRoutes.js
// Mount: /api/v1/email — DEV ONLY via shouldMountDevRoutes(). Never production/staging.
import express from "express";
import Email from "../utils/email.js";
import asyncHandler from "express-async-handler";
import { rejectInProduction } from "../middleware/devOnly.js";
import { protect, verifiedEmail, restrictTo, twoFactorAuth } from "../middleware/authMiddleware.js";
import { sensitiveAuthLimiter } from "../config/rateLimit.js";
import { authActionUrl } from "../utils/authActionUrl.js";

const router = express.Router();
router.use(rejectInProduction);
router.use(sensitiveAuthLimiter, protect, restrictTo("admin"), verifiedEmail, twoFactorAuth);

//  Send Welcome Email
router.post(
  "/send-welcome",
  asyncHandler(async (req, res) => {
    const { email, name } = req.body;

    if (!email || !name) {
      return res
        .status(400)
        .json({ status: "fail", message: "Email and name are required" });
    }

    const user = { email, name };
    const url = new URL('/products', process.env.CLIENT_URL).href;

    await new Email(user, url).sendWelcome();

    res
      .status(200)
      .json({ status: "success", message: "Welcome email sent successfully!" });
  })
);

//  Send Password Reset Email
router.post(
  "/send-password-reset",
  asyncHandler(async (req, res) => {
    const { email, name, resetToken } = req.body;

    if (!email || !name || !resetToken) {
      return res
        .status(400)
        .json({
          status: "fail",
          message: "Email, name, and reset token are required",
        });
    }

    const user = { email, name };
    const url = authActionUrl('reset-password', resetToken);

    await new Email(user, url).sendPasswordReset();

    res
      .status(200)
      .json({
        status: "success",
        message: "Password reset email sent successfully!",
      });
  })
);

//  Send Order Confirmation Email
router.post(
  "/send-order-confirmation",
  asyncHandler(async (req, res) => {
    const { email, name, order } = req.body;

    const orderId = order?.id ?? order?._id;
    const total = order?.total_price ?? order?.totalPrice ?? order?.total;
    if (!email || !name || !orderId || total == null) {
      return res
        .status(400)
        .json({
          status: "fail",
          message: "Email, name, and order details are required",
        });
    }

    const user = { email, name };
    const url = new URL(`/orders/${encodeURIComponent(orderId)}`, process.env.CLIENT_URL).href;

    await new Email(user, url).sendOrderConfirmation(order);

    res
      .status(200)
      .json({
        status: "success",
        message: "Order confirmation email sent successfully!",
      });
  })
);

//  Send Email Verification
router.post(
  "/send-verification",
  asyncHandler(async (req, res) => {
    const { email, name, verificationToken } = req.body;

    if (!email || !name || !verificationToken) {
      return res
        .status(400)
        .json({
          status: "fail",
          message: "Email, name, and verification token are required",
        });
    }

    const user = { email, name };
    const url = authActionUrl('verify-email', verificationToken);

    await new Email(user, url).sendVerificationEmail();

    res
      .status(200)
      .json({
        status: "success",
        message: "Verification email sent successfully!",
      });
  })
);

export default router;
