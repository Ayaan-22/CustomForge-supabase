// server/app.js — Express application (no listen; used by server.js and tests)
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import xss from "xss-clean";
import hpp from "hpp";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

import {
  logger,
  requestLogger,
  performanceLogger,
  errorLogger,
  requestIdMiddleware,
} from "./middleware/logger.js";

import {
  apiLimiter,
  authLimiter,
  paymentLimiter,
  publicLimiter,
  userActionLimiter,
  sensitiveAuthLimiter,
  adminLimiter,
  webhookLimiter,
} from "./config/rateLimit.js";

import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import emailTestRoutes from "./routes/emailTestRoutes.js";
import { handleWebhook } from "./controllers/paymentController.js";
import { csrfProtection } from "./middleware/csrfMiddleware.js";
import { shouldMountDevRoutes } from "./middleware/devOnly.js";
import { requestContextMiddleware } from "./utils/requestContext.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config({ path: "./config/config.env" });
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  throw new Error("TLS certificate verification must be enabled. Remove NODE_TLS_REJECT_UNAUTHORIZED=0 from the server environment.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", process.env.CLIENT_URL],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
          connectSrc: ["'self'", process.env.CLIENT_URL],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
  const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001";
  const ALLOWED_ORIGINS = [CLIENT_URL, ADMIN_URL];

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);

        if (ALLOWED_ORIGINS.includes(origin)) {
          return cb(null, true);
        }

        const allowLocalhost =
          process.env.NODE_ENV !== "production" &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

        if (allowLocalhost) {
          return cb(null, true);
        }

        logger.warn(`CORS blocked for origin: ${origin}`);
        cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-CSRF-Token",
        "X-2FA-Token",
      ],
    })
  );

  /* Stripe webhook: raw body, no JSON parser, no CSRF (signature-verified). Isolated from JWT payment routes. */
  app.post(
    "/api/v1/payment/webhook",
    webhookLimiter,
    express.raw({ type: "application/json" }),
    handleWebhook
  );

  app.use(compression());
  app.use(requestContextMiddleware);

  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(performanceLogger);

  app.use((req, res, next) => {
    if (req.requestId) res.setHeader("X-Request-ID", req.requestId);
    next();
  });

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    return publicLimiter(req, res, next);
  });

  app.use("/api/v1/auth", authLimiter);
  app.use("/api/v1/auth/register", sensitiveAuthLimiter);
  app.use("/api/v1/auth/forgot-password", sensitiveAuthLimiter);
  app.use("/api/v1/auth/reset-password", sensitiveAuthLimiter);
  app.use("/api/v1/auth/send-verification-email", sensitiveAuthLimiter);
  app.use("/api/v1/auth/resend-verification", sensitiveAuthLimiter);
  app.use("/api/v1/auth/login", sensitiveAuthLimiter);
  app.use("/api/v1/auth/refresh", sensitiveAuthLimiter);
  app.use("/api/v1/auth/verify-email", sensitiveAuthLimiter);
  app.use("/api/v1/auth/2fa", sensitiveAuthLimiter);
  app.use("/api/v1/auth/update-password", sensitiveAuthLimiter);
  app.use("/api/v1/users/change-password", sensitiveAuthLimiter);
  app.use("/api/v1/payment", paymentLimiter);
  app.use("/api/v1/orders", userActionLimiter);
  app.use("/api/v1/cart", userActionLimiter);
  app.use("/api/v1/users", userActionLimiter);
  app.use("/api/v1/reviews", userActionLimiter);
  app.use("/api/v1/admin", adminLimiter);

  app.use("/api", (req, res, next) => {
    const specializedRoutes = [
      "/v1/auth",
      "/v1/payment",
      "/v1/orders",
      "/v1/cart",
      "/v1/admin",
      "/v1/users",
      "/v1/reviews",
    ];
    const isSpecialized = specializedRoutes.some((route) =>
      req.path.toLowerCase() === route || req.path.toLowerCase().startsWith(`${route}/`)
    );
    if (isSpecialized) return next();
    return apiLimiter(req, res, next);
  });

  // Rate limits count malformed bodies and requests rejected by CSRF validation.
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));
  app.use(cookieParser());
  app.use(xss());
  app.use(hpp({ whitelist: ["price", "ratings", "duration"] }));
  app.use(csrfProtection);

  app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1/products", productRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/cart", cartRoutes);
  app.use("/api/v1/orders", orderRoutes);
  app.use("/api/v1/payment", paymentRoutes);
  app.use("/api/v1/reviews", reviewRoutes);

  if (shouldMountDevRoutes()) {
    app.use("/api/v1/email", emailTestRoutes);
  }

  app.get("/api/v1/health", (req, res) => {
    const payload = {
      status: "success",
      message: "Server is running",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    };
    if (process.env.NODE_ENV !== "production") {
      payload.environment = process.env.NODE_ENV;
    }
    res.status(200).json(payload);
  });

  app.all("*", (req, res) => {
    logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
    res.status(404).json({
      status: "fail",
      message: `Can't find ${req.originalUrl} on this server!`,
      requestId: req.requestId,
    });
  });

  app.use(errorLogger);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export { app };
export default app;
