const PRODUCTION_LIKE_ENVS = new Set(["production", "staging", "prod"]);

/**
 * Dev/debug routers are allowed only in local development.
 * `test` may opt in with ENABLE_DEV_ROUTES=true (never production/staging).
 */
export const isDevRouteEnv = (env = process.env.NODE_ENV) => {
  if (!env || PRODUCTION_LIKE_ENVS.has(env)) return false;
  if (env === "development") return true;
  if (env === "test") return process.env.ENABLE_DEV_ROUTES === "true";
  return false;
};

export const shouldMountDevRoutes = (env = process.env.NODE_ENV) =>
  isDevRouteEnv(env);

/**
 * Blocks debug/test routers unless the process is a allowed dev-route env.
 * Production and staging both 404 with the same shape as unknown routes.
 */
export const rejectInProduction = (req, res, next) => {
  if (isDevRouteEnv()) return next();

  return res.status(404).json({
    status: "fail",
    message: `Can't find ${req.originalUrl} on this server!`,
    requestId: req.requestId,
  });
};
