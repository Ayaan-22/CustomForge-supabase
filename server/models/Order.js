// server/models/Order.js
const requireClient = (client) => {
  if (!client) throw new Error("Supabase client is required");
  return client;
};

/* ===========================================================
   BASIC HELPERS
=========================================================== */

export const getOrderById = async (id, client) => {
  const db = requireClient(client);
  const { data, error } = await db
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
  { page = 1, limit = 10 } = {},
  client
) => {
  const db = requireClient(client);
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(parseInt(limit, 10) || 10, 50);
  const from = (p - 1) * l;
  const to = from + l - 1;

  const { data, error, count } = await db
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

export const createOrder = async (payload, client) => {
  const db = requireClient(client);
  const { data, error } = await db
    .from("orders")
    .insert([payload])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const markOrderPaid = async (orderId, paymentResult, client, expectedOrder) => {
  const db = requireClient(client);
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from("orders")
    .update({
      is_paid: true,
      paid_at: nowIso,
      payment_result: paymentResult,
      status: expectedOrder.status === "pending" ? "paid" : expectedOrder.status,
      updated_at: nowIso,
    })
    .eq("id", orderId).eq("is_paid",false).eq("payment_method","cod").eq("status",expectedOrder.status).eq("updated_at",expectedOrder.updated_at)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const updateOrderStatus = async (orderId, status, client) => {
  const db = requireClient(client);
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("orders")
    .update({ status, updated_at: nowIso })
    .eq("id", orderId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};
