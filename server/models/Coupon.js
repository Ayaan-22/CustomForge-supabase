// server/models/Coupon.js
import { supabase } from "../config/db.js";

export const COUPON_CONSTANTS = {
  MIN_CODE_LENGTH: 3,
  MAX_CODE_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_PERCENT_DISCOUNT: 100,
};

/* ===========================================================
   DB ROW → DOMAIN OBJECT (camelCase)
=========================================================== */
const mapCouponRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    minPurchase: row.min_purchase,
    maxDiscount: row.max_discount,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    isActive: row.is_active,
    usageLimit: row.usage_limit,
    timesUsed: row.times_used,
    perUserLimit: row.per_user_limit,
    applicableProducts: row.applicable_products || [],
    excludedProducts: row.excluded_products || [],
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/* ===========================================================
   BASIC FIND (code only, no validity checks)
=========================================================== */
export const findByCodeRaw = async (code) => {
  const couponCode = String(code).trim().toUpperCase();

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", couponCode)
    .single();

  if (error) return null;
  return mapCouponRow(data);
};

/* ===========================================================
   FIND ACTIVE COUPON (FULL VALIDITY CHECK)
   Equivalent to Mongoose statics.findActiveByCode
=========================================================== */
export const findActiveCouponByCode = async (inputCode) => {
  if (!inputCode) return null;

  const code = String(inputCode).trim().toUpperCase();
  if (code.length < COUPON_CONSTANTS.MIN_CODE_LENGTH) {
    return null;
  }

  // Step 1: Fetch coupon by code
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code)
    .single();

  if (error) return null;

  const coupon = mapCouponRow(data);

  // Step 2: Basic validity check
  const nowValidation = isCouponCurrentlyValid(coupon, new Date());
  if (!nowValidation.valid) {
    return null;
  }

  // Step 3: Usage limit check
  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) {
    return null;
  }

  return coupon;
};

/* ===========================================================
   CHECK IF COUPON IS VALID (date range, active, usage)
   Equivalent to coupon.isCurrentlyValid()
=========================================================== */
export const isCouponCurrentlyValid = (coupon, now = new Date()) => {
  const nowTs = now instanceof Date ? now : new Date(now);

  if (!coupon.isActive) {
    return { valid: false, reason: "Coupon is inactive" };
  }

  if (coupon.validFrom && new Date(coupon.validFrom) > nowTs) {
    return { valid: false, reason: "Coupon not yet valid" };
  }

  if (coupon.validTo && new Date(coupon.validTo) < nowTs) {
    return { valid: false, reason: "Coupon expired" };
  }

  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) {
    return { valid: false, reason: "Coupon usage limit reached" };
  }

  return { valid: true, reason: null };
};

/* ===========================================================
   PRODUCT APPLICABILITY CHECK
   Equivalent to coupon.isApplicableToProducts()
=========================================================== */
export const isCouponApplicableToProducts = (coupon, productIds = []) => {
  const ids = productIds.map((id) => String(id));

  // If applicableProducts list exists → all items must match allowed list
  if (coupon.applicableProducts?.length > 0) {
    const allowed = new Set(coupon.applicableProducts.map((p) => String(p)));

    const allAllowed = ids.every((id) => allowed.has(id));
    if (!allAllowed) {
      return {
        valid: false,
        reason: "Coupon is not applicable to some products in the cart",
      };
    }
  }

  // If excludedProducts list exists → none of the cart items may match
  if (coupon.excludedProducts?.length > 0) {
    const excluded = new Set(coupon.excludedProducts.map((p) => String(p)));

    const hasExcluded = ids.some((id) => excluded.has(id));
    if (hasExcluded) {
      return {
        valid: false,
        reason: "Coupon cannot be applied to one or more products",
      };
    }
  }

  return { valid: true, reason: null };
};

/* ===========================================================
   COMPUTE DISCOUNT FROM COUPON
   Equivalent to coupon.computeDiscount(subtotal)
=========================================================== */
export const computeCouponDiscount = (coupon, subtotal) => {
  const amount = Number(subtotal) || 0;
  if (amount <= 0) return 0;

  let discount = 0;

  if (coupon.discountType === "percent") {
    if (coupon.discountValue > COUPON_CONSTANTS.MAX_PERCENT_DISCOUNT) {
      return 0;
    }
    discount = (amount * Number(coupon.discountValue)) / 100;
  } else {
    discount = Number(coupon.discountValue);
  }

  // Apply max discount cap
  if (
    coupon.maxDiscount != null &&
    coupon.maxDiscount >= 0 &&
    discount > coupon.maxDiscount
  ) {
    discount = coupon.maxDiscount;
  }

  if (discount > amount) discount = amount;

  return Number(discount.toFixed(2));
};

/* ===========================================================
   INCREMENT USAGE (via SQL RPC)
=========================================================== */
export const incrementCouponUsage = async (couponId) => {
  const { data, error } = await supabase.rpc("increment_coupon_usage", {
    p_coupon_id: couponId,
  });

  if (error) throw new Error(error.message);

  return mapCouponRow(data?.[0]);
};
