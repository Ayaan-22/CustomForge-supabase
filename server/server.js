// server/server.js
import dotenv from "dotenv";
import { app } from "./app.js";
import { logger } from "./middleware/logger.js";

dotenv.config({ path: "./config/config.env" });

const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || "development";

const shouldListen =
  process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";

let server;

if (shouldListen) {
  server = app.listen(PORT, () => {
    logger.info(`🚀 Server running in ${ENV} mode on port ${PORT}`);
    logger.info(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
  });

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
}

export { app, server };
