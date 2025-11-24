// server/models/Game.js
import { supabase } from "../config/db.js";

/* ===========================================================
   MAP
=========================================================== */

const mapGameRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id,
    genre: row.genre || [],
    platform: row.platform || [],
    developer: row.developer,
    publisher: row.publisher,
    releaseDate: row.release_date,
    ageRating: row.age_rating,
    multiplayer: row.multiplayer,
    systemRequirements: row.system_requirements,
    languages: row.languages,
    edition: row.edition,
    metacriticScore:
      row.metacritic_score != null ? Number(row.metacritic_score) : null,
    features: row.features,
    ratingsAverage:
      row.ratings_average != null ? Number(row.ratings_average) : 0,
    ratingsTotalReviews: row.ratings_total_reviews ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/* ===========================================================
   CRUD
=========================================================== */

export const createGame = async (payload) => {
  const { data, error } = await supabase
    .from("games")
    .insert([
      {
        product_id: payload.productId,
        genre: payload.genre ?? [],
        platform: payload.platform ?? [],
        developer: payload.developer,
        publisher: payload.publisher,
        release_date: payload.releaseDate,
        age_rating: payload.ageRating,
        multiplayer: payload.multiplayer ?? null,
        system_requirements: payload.systemRequirements ?? null,
        languages: payload.languages ?? null,
        edition: payload.edition ?? null,
        metacritic_score: payload.metacriticScore ?? null,
        features: payload.features ?? null,
        ratings_average: payload.ratingsAverage ?? 0,
        ratings_total_reviews: payload.ratingsTotalReviews ?? 0,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapGameRow(data);
};

export const getGameByProductId = async (productId) => {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapGameRow(data) : null;
};

export const updateGame = async (id, updates) => {
  const dbUpdates = {
    genre: updates.genre,
    platform: updates.platform,
    developer: updates.developer,
    publisher: updates.publisher,
    release_date: updates.releaseDate,
    age_rating: updates.ageRating,
    multiplayer: updates.multiplayer,
    system_requirements: updates.systemRequirements,
    languages: updates.languages,
    edition: updates.edition,
    metacritic_score: updates.metacriticScore,
    features: updates.features,
    ratings_average: updates.ratingsAverage,
    ratings_total_reviews: updates.ratingsTotalReviews,
    updated_at: new Date().toISOString(),
  };

  Object.keys(dbUpdates).forEach(
    (key) => dbUpdates[key] === undefined && delete dbUpdates[key]
  );

  const { data, error } = await supabase
    .from("games")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapGameRow(data);
};

export const deleteGame = async (id) => {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
};
