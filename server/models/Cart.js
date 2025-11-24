// server/models/Cart.js
import { supabase } from "../config/db.js";

/* ===========================================================
   CART HELPERS
=========================================================== */

const isValidUUID = (value) =>
  typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);

export const CART_CONFIG = {
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 10,
};

/**
 * Get or create a cart row for a user (no items)
 */
export const getOrCreateCart = async (userId) => {
  if (!isValidUUID(userId)) throw new Error("Invalid user ID");

  let { data: cart, error } = await supabase
    .from("carts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!cart) {
    const { data: newCart, error: insertError } = await supabase
      .from("carts")
      .insert([{ user_id: userId }])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);
    cart = newCart;
  }

  return cart;
};

/**
 * Load cart with items & product details
 */
export const getCartWithItems = async (userId) => {
  if (!isValidUUID(userId)) throw new Error("Invalid user ID");

  const { data: cart, error } = await supabase
    .from("carts")
    .select(
      `
      id,
      user_id,
      coupon:coupon_id (
        id,
        code,
        discount_type,
        discount_value,
        min_purchase,
        max_discount,
        valid_from,
        valid_to,
        is_active,
        usage_limit,
        times_used,
        per_user_limit,
        applicable_products,
        excluded_products,
        description
      ),
      items:cart_items (
        id,
        quantity,
        added_at,
        product:products (
          id,
          name,
          images,
          final_price,
          stock,
          is_active
        )
      )
    `
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!cart) {
    return {
      id: null,
      user_id: userId,
      items: [],
      coupon: null,
    };
  }

  cart.items = cart.items || [];
  return cart;
};

/**
 * Clear cart (items + coupon)
 */
export const clearCart = async (userId) => {
  const cart = await getOrCreateCart(userId);

  const { error: itemsError } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cart.id);

  if (itemsError) throw new Error(itemsError.message);

  const { error: cartError } = await supabase
    .from("carts")
    .update({ coupon_id: null })
    .eq("id", cart.id);

  if (cartError) throw new Error(cartError.message);
  return true;
};

/**
 * Add or increment item in cart
 */
export const addCartItem = async (userId, productId, quantity) => {
  const cart = await getOrCreateCart(userId);

  const { data: existing, error } = await supabase
    .from("cart_items")
    .select("*")
    .eq("cart_id", cart.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const qty = Number(quantity) || 1;

  if (!existing) {
    const { error: insertError } = await supabase
      .from("cart_items")
      .insert([
        {
          cart_id: cart.id,
          product_id: productId,
          quantity: qty,
        },
      ]);

    if (insertError) throw new Error(insertError.message);
  } else {
    const newQty = Math.min(
      CART_CONFIG.MAX_QUANTITY,
      existing.quantity + qty
    );

    const { error: updateError } = await supabase
      .from("cart_items")
      .update({ quantity: newQty })
      .eq("id", existing.id);

    if (updateError) throw new Error(updateError.message);
  }

  return getCartWithItems(userId);
};

/**
 * Update cart item quantity
 */
export const updateCartItem = async (
  userId,
  productId,
  quantity
) => {
  const cart = await getOrCreateCart(userId);

  const { data: existing, error } = await supabase
    .from("cart_items")
    .select("*")
    .eq("cart_id", cart.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!existing) {
    throw new Error("Product not found in cart");
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < CART_CONFIG.MIN_QUANTITY) {
    throw new Error("Invalid quantity");
  }

  const { error: updateError } = await supabase
    .from("cart_items")
    .update({ quantity: qty })
    .eq("id", existing.id);

  if (updateError) throw new Error(updateError.message);

  return getCartWithItems(userId);
};

/**
 * Remove item from cart
 */
export const removeCartItem = async (userId, productId) => {
  const cart = await getOrCreateCart(userId);

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cart.id)
    .eq("product_id", productId);

  if (error) throw new Error(error.message);
  return getCartWithItems(userId);
};
