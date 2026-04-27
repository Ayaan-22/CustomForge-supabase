# Frontend-Backend Schema Alignment Summary

## Overview

This document summarizes the changes made to ensure the frontend strictly follows the database schema defined in `server/models/migrations/schema.sql`.

## Key Schema Requirements

### User Addresses Table (`user_addresses`)

According to the schema, the `user_addresses` table has the following structure:

```sql
create table if not exists user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  label text default 'Home',
  full_name text not null,
  address text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  country text default 'United States',
  phone_number text not null,
  is_default boolean default false
);
```

### Orders Table (`orders`)

The `shipping_address` field is stored as JSONB and follows this structure:

```json
{
  "fullName": "string",
  "address": "string",
  "city": "string",
  "state": "string",
  "postalCode": "string",
  "country": "string",
  "phoneNumber": "string"
}
```

## Changes Made

### 1. Updated `client/lib/types.ts`

**Changed:** `Address` interface to match the database schema

**Before:**

```typescript
export interface Address {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}
```

**After:**

```typescript
export interface Address {
  id: string;
  userId?: string;
  label?: string;
  fullName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phoneNumber: string;
  isDefault?: boolean;
  // Legacy fields for backward compatibility
  line1?: string;
  line2?: string;
}
```

**Rationale:** The schema stores address as a single `address` field (text), not split into `line1` and `line2`. Added `fullName` and `phoneNumber` as required fields per schema.

### 2. Updated `client/services/user-service.ts`

**Changed:** `AddressPayload` type to exclude legacy fields

```typescript
export type AddressPayload = Omit<Address, "id" | "isDefault" | "userId" | "line1" | "line2">;
```

**Rationale:** Ensures the payload sent to the API matches the schema requirements.

### 3. Updated `client/app/addresses/page.tsx`

**Changes:**

- Added `fullName` and `phoneNumber` fields to the form
- Combined `line1` and `line2` into a single `address` field when submitting
- Updated address display to show `fullName`, `address`, and `phoneNumber`
- Updated mutation types to match the schema

**Key Logic:**

```typescript
const addressData = {
  fullName: formData.fullName,
  phoneNumber: formData.phoneNumber,
  address: formData.line2 ? `${formData.line1}, ${formData.line2}` : formData.line1,
  city: formData.city,
  state: formData.state,
  postalCode: formData.postalCode,
  country: formData.country,
};
```

**Rationale:** The UI still allows users to enter address in two lines for better UX, but combines them into a single field when sending to the backend.

### 4. Updated `client/app/addresses/new/page.tsx`

**Changes:**

- Added `fullName` and `phoneNumber` fields to the form
- Combined `line1` and `line2` into a single `address` field when submitting

**Rationale:** Same as above - maintains good UX while conforming to schema.

### 5. Updated `client/app/orders/[id]/page.tsx`

**Changes:**

- Updated shipping address display to show schema fields:
  - `fullName` (displayed as header)
  - `address` (single line)
  - `city`, `state`, `postalCode`
  - `country`
  - `phoneNumber`

**Before:**

```typescript
<div>{order.address.line1}</div>
{order.address.line2 && <div>{order.address.line2}</div>}
```

**After:**

```typescript
<div className="font-medium">{order.address.fullName}</div>
<div>{order.address.address}</div>
<div>{order.address.phoneNumber}</div>
```

**Rationale:** Orders store the shipping address as JSONB following the schema structure.

## Backend Verification

The backend (`server/controllers/orderController.js`) correctly transforms the database address format:

```javascript
const loadAddressById = async (userId, addressId) => {
  // ... fetch from user_addresses table
  return {
    fullName: cleaned.full_name,
    address: cleaned.address,
    city: cleaned.city,
    state: cleaned.state,
    postalCode: cleaned.postal_code,
    country: cleaned.country,
    phoneNumber: cleaned.phone_number,
  };
};
```

This ensures that addresses stored in orders match the schema structure.

## Testing Checklist

- [x] Address creation with fullName and phoneNumber
- [x] Address editing preserves all fields
- [x] Address display shows all schema fields
- [x] Order details page displays shipping address correctly
- [x] Checkout flow uses correct address format
- [x] TypeScript types match schema structure
- [x] No TypeScript diagnostics errors

## Backward Compatibility

The `Address` interface includes legacy `line1` and `line2` fields marked as optional to maintain backward compatibility with any existing code that might reference them. However, all new code should use the `address` field.

## Conclusion

The frontend now strictly follows the database schema for address handling. All address-related operations use the correct field names and structure as defined in the schema.
