// server/server.js
import dotenv from "dotenv";
import { app } from "./app.js";
import { logger } from "./middleware/logger.js";
import { getServiceClient } from "./config/db.js";
import { closeRateLimitStore } from "./config/rateLimit.js";
import { startOrderEmailWorker } from "./utils/orderEmailOutbox.js";
import { startStripeRecoveryWorker } from "./controllers/paymentController.js";

dotenv.config({ path: "./config/config.env" });

const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || "development";

const shouldListen =
  process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";

let server;

if (shouldListen) {
  // Serving checkout before its durable queues exist would lose confirmations
  // and reservations. These probes are read-only and run outside HTTP context.
  const database = getServiceClient();
  for (const [table, column] of [["order_email_outbox", "id"], ["stripe_checkout_attempts", "order_id"], ["orders", "payment_expires_at"]]) {
    const { error } = await database.from(table).select(column).limit(0).abortSignal(AbortSignal.timeout(5000));
    if (error) throw new Error("Apply the order-email outbox, Stripe reservation recovery and payment deadline migrations before starting the API");
  }
  const stopWorkers = [];
  server = app.listen(PORT, () => {
    stopWorkers.push(startOrderEmailWorker(), startStripeRecoveryWorker());
    logger.info(`🚀 Server running in ${ENV} mode on port ${PORT}`);
    logger.info(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
  });

  let shuttingDown = false;
  const shutdown = async code => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(code || 1), 30000);
    deadline.unref();
    const closed = new Promise(resolve => server.close(resolve));
    await Promise.allSettled(stopWorkers.map(stop => stop()));
    await closeRateLimitStore();
    await closed;
    clearTimeout(deadline);
    logger.info("API and background workers stopped");
    process.exit(code);
  };

  process.on("unhandledRejection", (err) => {
    logger.error("❌ Unhandled Rejection", {
      message: err.message,
      stack: err.stack,
    });
    void shutdown(1);
  });

  process.on("SIGTERM", () => {
    logger.info("👋 SIGTERM received. Shutting down gracefully...");
    void shutdown(0);
  });
  process.on("SIGINT", () => { void shutdown(0); });
}

export { app, server };
