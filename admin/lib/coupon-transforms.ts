/**
 * Data transformation utilities for coupon management
 * Handles field name conversions and discount type mapping between frontend and backend
 */

// Frontend Coupon Interface (camelCase)
export interface Coupon {
  id?: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  validFrom: string | null;
  validTo: string | null;
  minPurchase?: number;
  maxDiscount?: number;
  isActive: boolean;
  usageLimit?: number;
  timesUsed?: number;
  perUserLimit?: number;
  applicableProducts?: string[];
  excludedProducts?: string[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Backend Coupon Payload (camelCase - matching adminController.js expectations)
export interface CouponPayload {
  id?: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  validFrom: string | null;
  validTo: string | null;
  minPurchase?: number;
  maxDiscount?: number;
  isActive: boolean;
  usageLimit?: number;
  timesUsed?: number;
  perUserLimit?: number;
  applicableProducts?: string[];
  excludedProducts?: string[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Map frontend discount type to backend format
 * @param type Frontend discount type ("percentage" | "fixed")
 * @returns Backend discount type ("percent" | "fixed")
 */
export function mapDiscountTypeToBackend(
  type: "percentage" | "fixed"
): "percent" | "fixed" {
  return type === "percentage" ? "percent" : "fixed";
}

/**
 * Map backend discount type to frontend format
 * @param type Backend discount type ("percent" | "fixed")
 * @returns Frontend discount type ("percentage" | "fixed")
 */
export function mapDiscountTypeToFrontend(
  type: "percent" | "fixed"
): "percentage" | "fixed" {
  return type === "percent" ? "percentage" : "fixed";
}

/**
 * Validate and ensure ISO 8601 date format
 * @param date Date string to validate
 * @returns ISO 8601 formatted date string
 * @throws Error if date is invalid
 */
export function validateDateFormat(date: string): string {
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date format: ${date}`);
  }
  return dateObj.toISOString();
}

/**
 * Transform frontend coupon to backend payload
 * @param coupon Frontend coupon object
 * @returns Backend coupon payload
 */
export function transformCouponToBackend(coupon: Coupon): CouponPayload {
  // Create a shallow copy to avoid mutating the original
  const payload: any = { ...coupon };

  // Map discount type
  if (coupon.discountType) {
    payload.discountType = mapDiscountTypeToBackend(coupon.discountType);
  }

  // Validate date formats
  if (payload.validFrom) {
    payload.validFrom = validateDateFormat(payload.validFrom);
  }
  if (payload.validTo) {
    payload.validTo = validateDateFormat(payload.validTo);
  }

  return payload as CouponPayload;
}

/**
 * Transform backend coupon to frontend format
 * @param payload Backend coupon payload (or raw DB response which might be snake_case)
 * @returns Frontend coupon object
 */
export function transformCouponToFrontend(payload: any): Coupon {
  // Handle potential snake_case from raw DB responses if they bypass the controller transformation
  // or if the controller returns raw DB objects.
  const coupon: any = {};

  // Helper to get value from camelCase OR snake_case
  const get = (camel: string, snake: string) =>
    payload[camel] !== undefined ? payload[camel] : payload[snake];

  coupon.id = payload.id;
  coupon.code = payload.code;

  // Discount Type
  const rawType = get("discountType", "discount_type");
  coupon.discountType = rawType ? mapDiscountTypeToFrontend(rawType) : "fixed";

  coupon.discountValue = get("discountValue", "discount_value");
  coupon.validFrom = get("validFrom", "valid_from");
  coupon.validTo = get("validTo", "valid_to");
  coupon.minPurchase = get("minPurchase", "min_purchase");
  coupon.maxDiscount = get("maxDiscount", "max_discount");
  coupon.isActive = get("isActive", "is_active");
  coupon.usageLimit = get("usageLimit", "usage_limit");
  coupon.timesUsed = get("timesUsed", "times_used");
  coupon.perUserLimit = get("perUserLimit", "per_user_limit");
  coupon.applicableProducts = get("applicableProducts", "applicable_products");
  coupon.excludedProducts = get("excludedProducts", "excluded_products");
  coupon.description = payload.description;
  coupon.createdAt = get("createdAt", "created_at");
  coupon.updatedAt = get("updatedAt", "updated_at");

  return coupon as Coupon;
}
