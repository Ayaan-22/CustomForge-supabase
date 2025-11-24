// server/models/Order.js
import { supabase } from "../config/db.js";

/* ===========================================================
   BASIC HELPERS
=========================================================== */

export const getOrderById = async (id) => {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      items:order_items (*)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
};

export const getUserOrders = async (
  userId,
  { page = 1, limit = 10 } = {}
) => {
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(parseInt(limit, 10) || 10, 50);
  const from = (p - 1) * l;
  const to = from + l - 1;

  const { data, error, count } = await supabase
    .from("orders")
    .select(
      `
      *,
      items:order_items (*)
    `,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  return {
    orders: data || [],
    total: count ?? (data ? data.length : 0),
    page: p,
    limit: l,
  };
};

export const createOrder = async (payload) => {
  const { data, error } = await supabase
    .from("orders")
    .insert([payload])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const markOrderPaid = async (orderId, paymentResult) => {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("orders")
    .update({
      is_paid: true,
      paid_at: nowIso,
      payment_result: paymentResult,
      status: "paid",
      updated_at: nowIso,
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const updateOrderStatus = async (orderId, status) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: nowIso })
    .eq("id", orderId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};