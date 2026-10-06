// Authentication secrets belong to server-side identity checks, never API responses.
const PRIVATE_FIELDS = new Set([
  "password", "two_factor_secret", "email_verification_token", "email_verification_expires",
  "password_reset_token", "password_reset_expires", "refresh_token_hash", "refresh_token_expires", "twoFactorSecret", "emailVerificationToken", "emailVerificationExpires",
  "passwordResetToken", "passwordResetExpires", "refreshTokenHash", "refreshTokenExpires",
]);

export const publicUser = (user) => Object.fromEntries(
  Object.entries(user).filter(([field]) => !PRIVATE_FIELDS.has(field))
);
