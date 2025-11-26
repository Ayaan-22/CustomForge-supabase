// server/server.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
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
  adminLimiter,
  publicLimiter,
  logRateLimiter,
} from "./config/rateLimit.js";

// Routes
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

// Error handling middleware
import { errorHandler } from "./middleware/errorMiddleware.js";

// Load environment variables
dotenv.config({ path: "./config/config.env" });

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ============================================================
   🛡️ SECURITY MIDDLEWARE
============================================================ */
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

// allow admin frontend to call API and send cookies
const ADMIN_URL = process.env.ADMIN_URL || process.env.CLIENT_URL || "http://localhost:3000";

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow non-browser requests (curl, server-side)
      cb(null, ADMIN_URL);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

/* ============================================================
   ⚡ STRIPE WEBHOOK — RAW BODY
   MUST COME BEFORE express.json()
============================================================ */
app.post(
  "/api/v1/payment/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

/* ============================================================
   🧰 BODY PARSING & SANITIZATION
============================================================ */
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// No mongoSanitize — no MongoDB anymore
app.use(xss());
app.use(
  hpp({
    whitelist: ["price", "ratings", "duration"],
  })
);
app.use(compression());

/* ============================================================
   🕵️ LOGGING & REQUEST ID
============================================================ */
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(performanceLogger);

app.use((req, res, next) => {
  if (req.requestId) res.setHeader("X-Request-ID", req.requestId);
  next();
});

/* ============================================================
   🚦 RATE LIMITING
============================================================ */
app.use("/api", apiLimiter);
app.use("/api/v1/auth", authLimiter);
app.use("/api/v1/payment", paymentLimiter);

app.use(publicLimiter);

/* ============================================================
   📁 STATIC FILES
============================================================ */
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

/* ============================================================
   🧩 API ROUTES
============================================================ */
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/email", emailTestRoutes);

/* ============================================================
   💚 HEALTH CHECK
============================================================ */
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    requestId: req.requestId,
  });
});

/* ============================================================
   ❌ HANDLE 404
============================================================ */
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

/* ============================================================
   🧨 ERROR HANDLER
============================================================ */
app.use(errorLogger);
app.use(errorHandler);

/* ============================================================
   🚀 START SERVER
============================================================ */
const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || "development";

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running in ${ENV} mode on port ${PORT}`);
  logger.info(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
});

/* ============================================================
   🧯 GRACEFUL SHUTDOWN
============================================================ */
process.on("unhandledRejection", (err) => {
  logger.error("❌ Unhandled Rejection", {
    message: err.message,
    stack: err.stack,
  });
  server.close(() => process.exit(1));
});

process.on("SIGTERM", () => {
  logger.info("👋 SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    logger.info("💥 Process terminated");
  });
});
