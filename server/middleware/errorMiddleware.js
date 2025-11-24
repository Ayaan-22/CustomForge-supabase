// server/middleware/errorMiddleware.js
import dotenv from "dotenv";
import AppError from "../utils/appError.js";
import { logger } from "./logger.js";

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || "production";

/* --------------------------------------------------------------------------
   Supabase-specific constraint handling
   -------------------------------------------------------------------------- */
const handleSupabaseError = (err) => {
  // Duplicate key (unique constraint)
  if (err.code === "23505") {
    return new AppError("Duplicate value. Use another value.", 400);
  }

  // Foreign key violation
  if (err.code === "23503") {
    return new AppError("Invalid reference ID.", 400);
  }

  // Not null violation
  if (err.code === "23502") {
    return new AppError(`Missing required field: ${err.column}`, 400);
  }

  return err;
};

/* --------------------------------------------------------------------------
   Development Error Response
   -------------------------------------------------------------------------- */
const sendErrorDev = (err, req, res) => {
  logger.error("[DEV ERROR]", err);

  res.status(err.statusCode || 500).json({
    status: "error",
    message: err.message,
    stack: err.stack,
    details: err.details || null,
    error: err,
  });
};

/* --------------------------------------------------------------------------
   Production Error Response
   -------------------------------------------------------------------------- */
const sendErrorProd = (err, req, res) => {
  logger.error("[ERROR]", err);

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  return res.status(500).json({
    status: "error",
    message: "Something went wrong!",
  });
};

/* --------------------------------------------------------------------------
   GLOBAL ERROR HANDLER
   -------------------------------------------------------------------------- */
export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = { ...err };
  error.message = err.message;

  // Convert Supabase errors
  if (err.code?.startsWith("23")) {
    error = handleSupabaseError(err);
  }

  if (NODE_ENV === "development") {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};
