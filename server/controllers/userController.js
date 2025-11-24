// server/controllers/userController.js
import asyncHandler from "express-async-handler";
import AppError from "../utils/appError.js";
import { logger } from "../middleware/logger.js";

// Supabase models
import {
  findUserById,
  updateUser,
  getWishlist,
  getUserAddresses as fetchUserAddresses,
  addUserAddress as createUserAddress,
  setDefaultAddress as setUserDefaultAddress,
  getUserPaymentMethods as fetchUserPaymentMethods,
  addUserPaymentMethod as createUserPaymentMethod,
  setDefaultPaymentMethod as setUserDefaultPaymentMethod,
  comparePassword,
} from "../models/User.js";

import { getUserOrders as fetchUserOrders } from "../models/Order.js";

import { supabase } from "../config/db.js";

/* ===========================================================
   filterObj — SAME LOGIC AS ORIGINAL
=========================================================== */
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  if (!obj || typeof obj !== "object") return newObj;

  Object.keys(obj).forEach((key) => {
    if (allowedFields.includes(key)) {
      newObj[key] = obj[key];
    }
  });

  return newObj;
};

/* ===========================================================
   @desc   GET LOGGED-IN USER PROFILE
   @route  GET /api/users/me
   @access Private
=========================================================== */
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await findUserById(req.user.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // === Populate Wishlist (Supabase version) ===
  const { data: wishlistRows, error } = await supabase
    .from("user_wishlist")
    .select(
      `
      product_id,
      products (
        id,
        name,
        images,
        final_price,
        category
      )
    `
    )
    .eq("user_id", req.user.id);

  if (error) throw new Error(error.message);

  const populatedWishlist = wishlistRows.map((row) => ({
    id: row.products.id,
    name: row.products.name,
    image: row.products.images?.[0] || null,
    finalPrice: row.products.final_price,
    category: row.products.category,
  }));

  res.status(200).json({
    success: true,
    data: {
      ...user,
      wishlist: populatedWishlist,
    },
  });

  logger.info("Fetched profile", { userId: req.user.id });
});

/* ===========================================================
   @desc   UPDATE USER PROFILE (NON-SENSITIVE)
   @route  PATCH /api/users/me
   @access Private
=========================================================== */
export const updateMe = asyncHandler(async (req, res, next) => {
  logger.info("Update self start", {
    userId: req.user.id,
    bodyKeys: Object.keys(req.body || {}),
  });

  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError("This route is not for password updates", 400));
  }

  // Allow only these profile fields
  const filteredBody = filterObj(
    req.body,
    "name",
    "avatar",
    "phone",
    "address"
  );

  const existingUser = await findUserById(req.user.id);
  if (!existingUser) {
    return next(new AppError("User not found", 404));
  }

  const updated = await updateUser(req.user.id, filteredBody);

  res.status(200).json({
    success: true,
    data: updated,
  });

  logger.info("Updated self", { userId: req.user.id });
});

/* ===========================================================
   @desc   SOFT DELETE / DEACTIVATE USER
   @route  DELETE /api/users/me
   @access Private
=========================================================== */
export const deleteMe = asyncHandler(async (req, res, next) => {
  logger.info("Deactivate self start", { userId: req.user.id });

  // Set active:false (Supabase update)
  const updated = await updateUser(req.user.id, { active: false });

  if (!updated) {
    return next(new AppError("User not found", 404));
  }

  res.status(204).json({
    success: true,
    data: null,
  });

  logger.info("Deactivated self", { userId: req.user.id });
});

/* ===========================================================
   @desc   GET USER WISHLIST
   @route  GET /api/users/wishlist
   @access Private
=========================================================== */
export const getWishlistController = asyncHandler(async (req, res, next) => {
  const user = await findUserById(req.user.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Query wishlist separately (Supabase join)
  const { data: rows, error } = await supabase
    .from("user_wishlist")
    .select(
      `
      product_id,
      products (
        id,
        name,
        images,
        final_price,
        category
      )
    `
    )
    .eq("user_id", req.user.id);

  if (error) throw new Error(error.message);

  const mapped = rows.map((row) => ({
    id: row.products.id,
    name: row.products.name,
    image: row.products.images?.[0] || null,
    finalPrice: row.products.final_price,
    category: row.products.category,
  }));

  res.status(200).json({
    success: true,
    results: mapped.length,
    data: mapped,
  });

  logger.info("Fetched user wishlist", {
    userId: req.user.id,
    results: mapped.length,
  });
});

/* ===========================================================
   @desc   GET USER ORDERS
   @route  GET /api/users/orders
   @access Private
=========================================================== */
export const getUserOrders = asyncHandler(async (req, res, next) => {
  const result = await fetchUserOrders(req.user.id, {
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 10,
  });

  res.status(200).json({
    success: true,
    results: result.orders.length,
    count: result.total,
    page: result.page,
    limit: result.limit,
    data: result.orders,
  });

  logger.info("Fetched user orders", {
    userId: req.user.id,
    results: result.orders.length,
  });
});

/* ===========================================================
   @desc   CHANGE PASSWORD
   @route  PATCH /api/users/change-password
   @access Private
=========================================================== */
export const changePassword = asyncHandler(async (req, res, next) => {
  const { passwordCurrent, password, passwordConfirm } = req.body;

  if (!passwordCurrent || !password || !passwordConfirm) {
    return next(
      new AppError(
        "Please provide current password, new password and passwordConfirm",
        400
      )
    );
  }

  if (password !== passwordConfirm) {
    return next(new AppError("Passwords do not match", 400));
  }

  const user = await findUserById(req.user.id, { includePassword: true });

  if (!user) return next(new AppError("User not found", 404));

  if (!(await comparePassword(passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }

  await updateUser(req.user.id, {
    password,
    passwordChangedAt: new Date().toISOString(),
  });

  res.status(200).json({
    success: true,
    message: "Password changed successfully",
  });

  logger.info("Password changed", { userId: req.user.id });
});

/* ===========================================================
   @desc   ADD TO WISHLIST
   @route  POST /api/users/wishlist/:productId
   @access Private
=========================================================== */
export const addToWishlist = asyncHandler(async (req, res, next) => {
  const productId = req.params.productId;

  if (!productId || !/^[0-9a-fA-F-]{36}$/.test(productId)) {
    return next(new AppError("Invalid product ID", 400));
  }

  const { error } = await supabase
    .from("user_wishlist")
    .insert([{ user_id: req.user.id, product_id: productId }]);

  if (error && error.code !== "23505") {
    // Ignore duplicate key error
    logger.error("Add to wishlist failed", { error: error.message });
    return next(new AppError("Failed to add to wishlist", 500));
  }

  res.status(200).json({
    success: true,
    message: "Product added to wishlist",
  });

  logger.info("Added to wishlist", { userId: req.user.id, productId });
});

/* ===========================================================
   @desc   REMOVE FROM WISHLIST
   @route  DELETE /api/users/wishlist/:productId
   @access Private
=========================================================== */
export const removeFromWishlist = asyncHandler(async (req, res, next) => {
  const productId = req.params.productId;

  if (!productId || !/^[0-9a-fA-F-]{36}$/.test(productId)) {
    return next(new AppError("Invalid product ID", 400));
  }

  const { error } = await supabase
    .from("user_wishlist")
    .delete()
    .eq("user_id", req.user.id)
    .eq("product_id", productId);

  if (error) {
    logger.error("Remove from wishlist failed", { error: error.message });
    return next(new AppError("Failed to remove from wishlist", 500));
  }

  res.status(200).json({
    success: true,
    message: "Product removed from wishlist",
  });

  logger.info("Removed from wishlist", { userId: req.user.id, productId });
});

/* ===========================================================
   @desc   GET USER ADDRESSES
   @route  GET /api/users/addresses
   @access Private
=========================================================== */
export const getUserAddresses = asyncHandler(async (req, res, next) => {
  const addresses = await fetchUserAddresses(req.user.id);

  res.status(200).json({
    success: true,
    results: addresses.length,
    data: addresses,
  });

  logger.info("Fetched user addresses", {
    userId: req.user.id,
    results: addresses.length,
  });
});

/* ===========================================================
   @desc   ADD USER ADDRESS
   @route  POST /api/users/addresses
   @access Private
=========================================================== */
export const addUserAddress = asyncHandler(async (req, res, next) => {
  const address = await createUserAddress(req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: address,
  });

  logger.info("Added user address", { userId: req.user.id });
});

/* ===========================================================
   @desc   UPDATE USER ADDRESS
   @route  PATCH /api/users/addresses/:id
   @access Private
=========================================================== */
export const updateUserAddress = asyncHandler(async (req, res, next) => {
  const addressId = req.params.id;

  if (!addressId || !/^[0-9a-fA-F-]{36}$/.test(addressId)) {
    return next(new AppError("Invalid address ID", 400));
  }

  const { data: existing, error: fetchError } = await supabase
    .from("user_addresses")
    .select("*")
    .eq("id", addressId)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return next(new AppError("Address not found", 404));
  }

  const updates = {
    label: req.body.label,
    full_name: req.body.fullName,
    address: req.body.address,
    city: req.body.city,
    state: req.body.state,
    postal_code: req.body.postalCode,
    country: req.body.country,
    phone_number: req.body.phoneNumber,
    is_default: req.body.isDefault,
  };

  Object.keys(updates).forEach(
    (key) => updates[key] === undefined && delete updates[key]
  );

  if (updates.is_default) {
    await supabase
      .from("user_addresses")
      .update({ is_default: false })
      .eq("user_id", req.user.id);
  }

  const { data: updated, error } = await supabase
    .from("user_addresses")
    .update(updates)
    .eq("id", addressId)
    .select()
    .single();

  if (error) {
    return next(new AppError("Failed to update address", 500));
  }

  res.status(200).json({
    success: true,
    data: updated,
  });

  logger.info("Updated user address", { userId: req.user.id, addressId });
});

/* ===========================================================
   @desc   SET DEFAULT ADDRESS
   @route  PATCH /api/users/addresses/:id/default
   @access Private
=========================================================== */
export const setDefaultAddress = asyncHandler(async (req, res, next) => {
  const addressId = req.params.id;

  if (!addressId || !/^[0-9a-fA-F-]{36}$/.test(addressId)) {
    return next(new AppError("Invalid address ID", 400));
  }

  const address = await setUserDefaultAddress(req.user.id, addressId);

  res.status(200).json({
    success: true,
    data: address,
  });

  logger.info("Set default address", { userId: req.user.id, addressId });
});

/* ===========================================================
   @desc   DELETE USER ADDRESS
   @route  DELETE /api/users/addresses/:id
   @access Private
=========================================================== */
export const deleteUserAddress = asyncHandler(async (req, res, next) => {
  const addressId = req.params.id;

  if (!addressId || !/^[0-9a-fA-F-]{36}$/.test(addressId)) {
    return next(new AppError("Invalid address ID", 400));
  }

  const { error } = await supabase
    .from("user_addresses")
    .delete()
    .eq("id", addressId)
    .eq("user_id", req.user.id);

  if (error) {
    return next(new AppError("Failed to delete address", 500));
  }

  res.status(204).json({
    success: true,
    data: null,
  });

  logger.info("Deleted user address", { userId: req.user.id, addressId });
});

/* ===========================================================
   @desc   GET USER PAYMENT METHODS
   @route  GET /api/users/payment-methods
   @access Private
=========================================================== */
export const getUserPaymentMethods = asyncHandler(async (req, res, next) => {
  const methods = await fetchUserPaymentMethods(req.user.id);

  res.status(200).json({
    success: true,
    results: methods.length,
    data: methods,
  });

  logger.info("Fetched user payment methods", {
    userId: req.user.id,
    results: methods.length,
  });
});

/* ===========================================================
   @desc   ADD USER PAYMENT METHOD
   @route  POST /api/users/payment-methods
   @access Private
=========================================================== */
export const addUserPaymentMethod = asyncHandler(async (req, res, next) => {
  const method = await createUserPaymentMethod(req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: method,
  });

  logger.info("Added user payment method", { userId: req.user.id });
});

/* ===========================================================
   @desc   UPDATE USER PAYMENT METHOD
   @route  PATCH /api/users/payment-methods/:id
   @access Private
=========================================================== */
export const updateUserPaymentMethod = asyncHandler(async (req, res, next) => {
  const methodId = req.params.id;

  if (!methodId || !/^[0-9a-fA-F-]{36}$/.test(methodId)) {
    return next(new AppError("Invalid payment method ID", 400));
  }

  const { data: existing, error: fetchError } = await supabase
    .from("user_payment_methods")
    .select("*")
    .eq("id", methodId)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return next(new AppError("Payment method not found", 404));
  }

  const updates = {
    type: req.body.type,
    card_holder_name: req.body.cardHolderName,
    card_number: req.body.cardNumber,
    expiry_month: req.body.expiryMonth,
    expiry_year: req.body.expiryYear,
    billing_address: req.body.billingAddress,
    is_default: req.body.isDefault,
  };

  Object.keys(updates).forEach(
    (key) => updates[key] === undefined && delete updates[key]
  );

  if (updates.is_default) {
    await supabase
      .from("user_payment_methods")
      .update({ is_default: false })
      .eq("user_id", req.user.id);
  }

  const { data: updated, error } = await supabase
    .from("user_payment_methods")
    .update(updates)
    .eq("id", methodId)
    .select()
    .single();

  if (error) {
    return next(new AppError("Failed to update payment method", 500));
  }

  res.status(200).json({
    success: true,
    data: updated,
  });

  logger.info("Updated user payment method", {
    userId: req.user.id,
    methodId,
  });
});

/* ===========================================================
   @desc   SET DEFAULT PAYMENT METHOD
   @route  PATCH /api/users/payment-methods/:id/default
   @access Private
=========================================================== */
export const setDefaultPaymentMethod = asyncHandler(async (req, res, next) => {
  const methodId = req.params.id;

  if (!methodId || !/^[0-9a-fA-F-]{36}$/.test(methodId)) {
    return next(new AppError("Invalid payment method ID", 400));
  }

  const method = await setUserDefaultPaymentMethod(req.user.id, methodId);

  res.status(200).json({
    success: true,
    data: method,
  });

  logger.info("Set default payment method", {
    userId: req.user.id,
    methodId,
  });
});

/* ===========================================================
   @desc   DELETE USER PAYMENT METHOD
   @route  DELETE /api/users/payment-methods/:id
   @access Private
=========================================================== */
export const deleteUserPaymentMethod = asyncHandler(async (req, res, next) => {
  const methodId = req.params.id;

  if (!methodId || !/^[0-9a-fA-F-]{36}$/.test(methodId)) {
    return next(new AppError("Invalid payment method ID", 400));
  }

  const { error } = await supabase
    .from("user_payment_methods")
    .delete()
    .eq("id", methodId)
    .eq("user_id", req.user.id);

  if (error) {
    return next(new AppError("Failed to delete payment method", 500));
  }

  res.status(204).json({
    success: true,
    data: null,
  });

  logger.info("Deleted user payment method", {
    userId: req.user.id,
    methodId,
  });
});
