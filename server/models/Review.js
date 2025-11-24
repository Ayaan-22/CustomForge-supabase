// server/models/Review.js
import { supabase } from "../config/db.js";
import { recalcProductRatings } from "./Product.js";

/* ===========================================================
   CREATE / UPDATE / DELETE REVIEWS
=========================================================== */

const isValidUUID = (value) =>
  typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);

export const createReview = async (payload) => {
  const insertData = {
    product_id: payload.productId,
    game_id: payload.gameId ?? null,
    user_id: payload.userId,
    rating: payload.rating,
    title: payload.title,
    comment: payload.comment,
    verified_purchase: payload.verifiedPurchase ?? false,
    helpful_votes: payload.helpfulVotes ?? 0,
    reported: payload.reported ?? false,
    report_reason: payload.reportReason ?? null,
    media: payload.media ?? [],
    platform: payload.platform ?? null,
    playtime_hours: payload.playtimeHours ?? null,
    is_active: payload.isActive ?? true,
  };

  const { data, error } = await supabase
    .from("reviews")
    .insert([insertData])
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (data.product_id) {
    await recalcProductRatings(data.product_id);
  }

  return data;
};

export const updateReview = async (reviewId, updates) => {
  const dbUpdates = {
    rating: updates.rating,
    title: updates.title,
    comment: updates.comment,
    verified_purchase: updates.verifiedPurchase,
    helpful_votes: updates.helpfulVotes,
    reported: updates.reported,
    report_reason: updates.reportReason,
    media: updates.media,
    platform: updates.platform,
    playtime_hours: updates.playtimeHours,
    is_active: updates.isActive,
    updated_at: new Date().toISOString(),
  };

  Object.keys(dbUpdates).forEach(
    (key) => dbUpdates[key] === undefined && delete dbUpdates[key]
  );

  const { data, error } = await supabase
    .from("reviews")
    .update(dbUpdates)
    .eq("id", reviewId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (data.product_id) {
    await recalcProductRatings(data.product_id);
  }

  return data;
};

export const softDeleteReview = async (reviewId) => {
  if (!isValidUUID(reviewId)) throw new Error("Invalid review ID");

  const { data, error } = await supabase
    .from("reviews")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", reviewId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (data.product_id) {
    await recalcProductRatings(data.product_id);
  }

  return data;
};
