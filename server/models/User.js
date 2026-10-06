import {validatePaymentMetadata} from "../utils/paymentMetadata.js";
// server/models/User.js
import bcrypt from "bcryptjs";
const requireClient = (client) => {
  if (!client) throw new Error("Supabase client is required");
  return client;
};

/**
 * Map DB row → camelCase user domain object
 */
const mapUserRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    avatar: row.avatar,
    phone: row.phone,
    address: row.address,
    isEmailVerified: row.is_email_verified,
    emailVerificationToken: row.email_verification_token,
    emailVerificationExpires: row.email_verification_expires,
    passwordResetToken: row.password_reset_token,
    passwordResetExpires: row.password_reset_expires,
    passwordChangedAt: row.password_changed_at,
    twoFactorEnabled: row.two_factor_enabled,
    twoFactorSecret: row.two_factor_secret,
    active: row.active,
    // Optional extra fields (only if they exist in DB):
    stripeCustomerId: row.stripe_customer_id || null,
    paymentMethods: row.payment_methods || null,
    refreshTokenHash: row.refresh_token_hash || null,
    refreshTokenExpires: row.refresh_token_expires || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/* ===========================================================
   BASIC USER CRUD
=========================================================== */

export const createUser = async (payload, client) => {
  const db = requireClient(client);
  // Hash password if provided and not already hashed
  let hashedPassword = payload.password;
  if (payload.password && !payload.password.startsWith("$2")) {
    hashedPassword = await hashPassword(payload.password);
  }

  const dataToInsert = {
    name: payload.name,
    email: payload.email,
    password: hashedPassword,
    role: payload.role ?? "user",
    avatar: payload.avatar ?? null,
    phone: payload.phone ?? null,
    address: payload.address ?? null,
    is_email_verified: payload.isEmailVerified ?? false,
    email_verification_token: payload.emailVerificationToken ?? null,
    email_verification_expires: payload.emailVerificationExpires ?? null,
    password_reset_token: payload.passwordResetToken ?? null,
    password_reset_expires: payload.passwordResetExpires ?? null,
    password_changed_at: payload.passwordChangedAt ?? null,
    two_factor_enabled: payload.twoFactorEnabled ?? false,
    two_factor_secret: payload.twoFactorSecret ?? null,
    active: payload.active ?? true,
    refresh_token_hash: payload.refreshTokenHash ?? null,
    refresh_token_expires: payload.refreshTokenExpires ?? null,
  };

  const { data, error } = await db
    .from("users")
    .insert([dataToInsert])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapUserRow(data);
};

export const findUserByEmail = async (email, options = {}, client) => {
  const db = requireClient(client);
  const { includePassword = false } = options;

  // Select all fields - will include optional columns if they exist
  const selectFields = includePassword
    ? "*"
    : "id, name, email, role, avatar, phone, address, is_email_verified, email_verification_token, email_verification_expires, password_reset_token, password_reset_expires, password_changed_at, two_factor_enabled, two_factor_secret, active, stripe_customer_id, payment_methods, refresh_token_hash, refresh_token_expires, created_at, updated_at";

  const { data, error } = await db
    .from("users")
    .select(selectFields)
    .ilike("email", email.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapUserRow(data);
};

export const findUserById = async (id, options = {}, client) => {
  const db = requireClient(client);
  const { includePassword = false } = options;

  // Select all fields - will include optional columns if they exist
  const selectFields = includePassword
    ? "*"
    : "id, name, email, role, avatar, phone, address, is_email_verified, email_verification_token, email_verification_expires, password_reset_token, password_reset_expires, password_changed_at, two_factor_enabled, two_factor_secret, active, stripe_customer_id, payment_methods, refresh_token_hash, refresh_token_expires, created_at, updated_at";

  const { data, error } = await db
    .from("users")
    .select(selectFields)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapUserRow(data);
};

/* ===========================================================
   PASSWORD UTILITIES
=========================================================== */

export const comparePassword = async (candidatePassword, hashedPassword) => {
  if (!candidatePassword || !hashedPassword) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, hashedPassword);
};

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
};

export const updateUser = async (id, updates, client) => {
  const db = requireClient(client);
  const dbUpdates = {
    name: updates.name,
    email: updates.email,
    password: updates.password,
    role: updates.role,
    avatar: updates.avatar,
    phone: updates.phone,
    address: updates.address,
    is_email_verified: updates.isEmailVerified,
    email_verification_token: updates.emailVerificationToken,
    email_verification_expires: updates.emailVerificationExpires,
    password_reset_token: updates.passwordResetToken,
    password_reset_expires: updates.passwordResetExpires,
    password_changed_at: updates.passwordChangedAt,
    two_factor_enabled: updates.twoFactorEnabled,
    two_factor_secret: updates.twoFactorSecret,
    active: updates.active,
    updated_at: new Date().toISOString(),
  };

  // Only include optional fields if they're provided and the columns exist
  if (updates.stripeCustomerId !== undefined) {
    dbUpdates.stripe_customer_id = updates.stripeCustomerId;
  }
  if (updates.paymentMethods !== undefined) {
    dbUpdates.payment_methods = updates.paymentMethods;
  }
  if (updates.refreshTokenHash !== undefined) {
    dbUpdates.refresh_token_hash = updates.refreshTokenHash;
  }
  if (updates.refreshTokenExpires !== undefined) {
    dbUpdates.refresh_token_expires = updates.refreshTokenExpires;
  }

  // Hash password if provided and not already hashed
  if (updates.password && !updates.password.startsWith("$2")) {
    dbUpdates.password = await hashPassword(updates.password);
    dbUpdates.password_changed_at = new Date().toISOString();
  }

  // Remove undefined keys
  Object.keys(dbUpdates).forEach(
    (key) => dbUpdates[key] === undefined && delete dbUpdates[key]
  );

  const { data, error } = await db
    .from("users")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapUserRow(data);
};

/* ===========================================================
   USER ADDRESSES
=========================================================== */

// Map address row from DB to frontend format
const mapAddressRow = (row) => {
  if (!row) return null;
  // Split address into line1 and line2 if it contains a comma
  const addressParts = row.address?.split(", ") || [row.address || ""];
  return {
    id: row.id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    line1: addressParts[0] || "",
    line2: addressParts[1] || "",
    address: row.address, // Keep original for compatibility
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: row.is_default,
    label: row.label,
  };
};

export const getUserAddresses = async (userId, client) => {
  const db = requireClient(client);
  const { data, error } = await db
    .from("user_addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error) throw new Error(error.message);
  return data.map(mapAddressRow);
};

export const addUserAddress = async (userId, address, client) => {
  const db = requireClient(client);
  const payload = {
    user_id: userId,
    label: address.label ?? "Home",
    full_name: address.fullName,
    address: address.address,
    city: address.city,
    state: address.state,
    postal_code: address.postalCode,
    country: address.country ?? "United States",
    phone_number: address.phoneNumber,
    is_default: address.isDefault ?? false,
  };

  if (payload.is_default) {
    await db
      .from("user_addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
  }

  const { data, error } = await db
    .from("user_addresses")
    .insert([payload])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapAddressRow(data);
};

export const setDefaultAddress = async (userId, addressId, client) => {
  const db = requireClient(client);
  const { error: clearError } = await db
    .from("user_addresses")
    .update({ is_default: false })
    .eq("user_id", userId);

  if (clearError) throw new Error(clearError.message);

  const { data, error } = await db
    .from("user_addresses")
    .update({ is_default: true })
    .eq("user_id", userId)
    .eq("id", addressId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapAddressRow(data);
};

/* ===========================================================
   USER PAYMENT METHODS
   (user_payment_methods table)
=========================================================== */

export const getUserPaymentMethods = async (userId, client) => {
  const db = requireClient(client);
  const { data, error } = await db
    .from("user_payment_methods")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

export const addUserPaymentMethod = async (userId, method, client) => {
  validatePaymentMetadata(method);
  const db = requireClient(client);
  const payload = {
    user_id: userId,
    type: method.type,
    card_holder_name: method.cardHolderName,
    card_number: method.cardNumber,
    expiry_month: method.expiryMonth,
    expiry_year: method.expiryYear,
    billing_address: method.billingAddress ?? null,
    is_default: method.isDefault ?? false,
  };

  if (payload.is_default) {
    await db
      .from("user_payment_methods")
      .update({ is_default: false })
      .eq("user_id", userId);
  }

  const { data, error } = await db
    .from("user_payment_methods")
    .insert([payload])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const setDefaultPaymentMethod = async (userId, methodId, client) => {
  const db = requireClient(client);
  const { error: clearError } = await db
    .from("user_payment_methods")
    .update({ is_default: false })
    .eq("user_id", userId);

  if (clearError) throw new Error(clearError.message);

  const { data, error } = await db
    .from("user_payment_methods")
    .update({ is_default: true })
    .eq("user_id", userId)
    .eq("id", methodId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/* ===========================================================
   USER WISHLIST
=========================================================== */

export const getWishlist = async (userId, client) => {
  const db = requireClient(client);
  const { data, error } = await db
    .from("user_wishlist")
    .select("product_id")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return data.map((row) => row.product_id);
};

export const addToWishlist = async (userId, productId, client) => {
  const db = requireClient(client);
  const { error } = await db
    .from("user_wishlist")
    .insert([{ user_id: userId, product_id: productId }]);

  if (error && error.code !== "23505") {
    // ignore unique violation
    throw new Error(error.message);
  }
  return true;
};

export const removeFromWishlist = async (userId, productId, client) => {
  const db = requireClient(client);
  const { error } = await db
    .from("user_wishlist")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (error) throw new Error(error.message);
  return true;
};
