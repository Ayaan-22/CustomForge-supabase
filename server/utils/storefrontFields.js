// Mirror the database's public column allowlists. Never widen these with '*'.
export const PRODUCT_FIELDS = "id,name,category,brand,specifications,original_price,discount_percentage,final_price,stock,availability,images,description,ratings,features,warranty,weight,dimensions,sku,is_active,is_featured,created_at,updated_at";
export const GAME_FIELDS = "id,product_id,genre,platform,developer,publisher,release_date,age_rating,multiplayer,system_requirements,languages,edition,metacritic_score,features,ratings_average,ratings_total_reviews,created_at,updated_at";
export const PREBUILT_FIELDS = "id,product_id,name,description,category,cpu,gpu,motherboard,ram,storage,power_supply,pc_case,cooling_system,operating_system,warranty_period,images,stock,ratings,features,sku,created_at,updated_at";
export const REVIEW_FIELDS = "id,product_id,game_id,rating,title,comment,verified_purchase,helpful_votes,media,platform,playtime_hours,created_at,updated_at";
export const OWN_REVIEW_FIELDS = `${REVIEW_FIELDS},user_id,is_active`;

export const mapPublicReview = (review) => ({
  id: review.id, rating: review.rating, title: review.title, comment: review.comment,
  createdAt: review.created_at, verifiedPurchase: review.verified_purchase,
  helpfulVotes: review.helpful_votes, media: review.media,
  // A public review is not permission to expose the author's private profile.
  user: null,
});
