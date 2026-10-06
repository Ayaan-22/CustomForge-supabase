// Tests must never use the developer's database, payment keys, or mail service.
Object.assign(process.env, {
  NODE_ENV: "test",
  NODE_TLS_REJECT_UNAUTHORIZED: "1",
  SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  SUPABASE_JWT_SECRET: "test-only-database-signing-secret-never-production",
  JWT_SECRET: "route-security-tests-only-secret",
  CSRF_SECRET: "route-security-tests-only-csrf",
  STRIPE_SECRET_KEY: "sk_test_route_security",
  STRIPE_WEBHOOK_SECRET: "whsec_route_security",
  RATE_LIMIT_ENABLED: "true",
  RATE_AUTH_MAX: "10000",
  RATE_PAYMENT_MAX: "10000",
  RATE_ADMIN_MAX: "10000",
  RATE_USER_ACTION_MAX: "10000",
  RATE_LIMIT_MAX: "10000",
  RATE_LOG_MAX: "10000",
  RATE_SENSITIVE_AUTH_MAX: "3",
  RATE_WEBHOOK_MAX: "3",
});
delete process.env.ENABLE_DEV_ROUTES;
delete process.env.RATE_LIMIT_IN_TEST;
