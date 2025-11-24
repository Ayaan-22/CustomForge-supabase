# CustomForge Schema Documentation

## Overview

This document outlines the complete data schema for the CustomForge e-commerce platform. All API responses, mock data, and TypeScript types must strictly adhere to this schema.

## Schema Definition

The authoritative schema is defined in `lib/schema.ts` using TypeScript interfaces and Zod validators. This ensures:

- **Type Safety**: Full TypeScript support across the codebase
- **Runtime Validation**: Zod schemas catch invalid data at runtime
- **Single Source of Truth**: All types, mock data, and validations reference one schema
- **Documentation**: Self-documenting types with full field descriptions

## Core Entities

### Users

Represents platform users with authentication and profile data.

\`\`\`typescript
User {
  id: UUID                    // Unique identifier
  name: string                // User's full name
  email: string               // Unique email address
  role: "user" | "admin"      // User role
  avatar?: string             // Profile picture URL
  phone?: string              // Contact phone
  isEmailVerified: boolean    // Email verification status
  twoFactorEnabled: boolean   // 2FA status
  active: boolean             // Account active status
  createdAt: DateTime         // Account creation time
  updatedAt: DateTime         // Last update time
}
\`\`\`

### Products

Gaming components and PC hardware with detailed specifications.

\`\`\`typescript
Product {
  id: UUID                              // Unique identifier
  name: string                          // Product name
  category: string                      // Product category
  brand: string                         // Manufacturer
  specifications?: Array<{key, value}> // Technical specs
  originalPrice: number                 // Base price (in paise)
  discountPercentage: number (0-100)   // Discount percentage
  finalPrice: number                    // Final price after discount
  stock: number                         // Available units
  availability: "In Stock" | ...        // Availability status
  images: string[]                      // Product images (URLs)
  description: string                   // Product description
  ratings: { average: 0-5, totalReviews: number }
  features?: string[]                   // Key features list
  warranty: string                      // Warranty information
  sku: string                           // Stock keeping unit
  isActive: boolean                     // Product active status
  isFeatured: boolean                   // Featured product flag
  salesCount: number                    // Total units sold
  createdAt: DateTime
  updatedAt: DateTime
}
\`\`\`

### Orders

Customer purchase orders with line items and tracking.

\`\`\`typescript
Order {
  id: UUID
  userId: UUID
  shippingAddress: object               // Address details
  paymentMethod: string                 // Payment type
  itemsPrice: number                    // Subtotal (paise)
  discountAmount: number                // Applied discount
  shippingPrice: number                 // Shipping fee
  taxPrice: number                      // Tax amount
  totalPrice: number                    // Final total
  status: OrderStatus                   // Current status
  isPaid: boolean
  isDelivered: boolean
  returnStatus: "none" | "requested" | ...
  items: OrderItem[]                    // Line items
  createdAt: DateTime
  updatedAt: DateTime
}
\`\`\`

### Reviews

Product reviews and ratings from customers.

\`\`\`typescript
Review {
  id: UUID
  productId: UUID
  userId: UUID
  rating: 1-5
  title: string
  comment: string
  verifiedPurchase: boolean
  helpfulVotes: number
  isActive: boolean
  createdAt: DateTime
  updatedAt: DateTime
}
\`\`\`

## Schema Compliance Rules

### 1. Type Validation

All TypeScript code must use types from `lib/schema.ts`:

\`\`\`typescript
// ✅ GOOD
import { User, Product } from "@/lib/schema"

const user: User = { ... }
const product: Product = { ... }

// ❌ BAD
const user: any = { ... }
const product: { name: string } = { ... }
\`\`\`

### 2. Runtime Validation

Validate external data (API responses, form inputs) using Zod:

\`\`\`typescript
import { validateSchema, UserSchema } from "@/lib/schema-validation"

const user = validateSchema(UserSchema, data, "User")
\`\`\`

### 3. Mock Data Requirements

All mock JSON files must conform to their schemas:

\`\`\`json
{
  "id": "uuid-here",
  "name": "Product Name",
  "ratings": { "average": 4.5, "totalReviews": 100 }
}
\`\`\`

### 4. API Response Format

All API handlers must return validated data:

\`\`\`typescript
export async function GET() {
  const products = await db.products.getAll()
  const validated = products.map(p => validateSchema(ProductSchema, p, "Product"))
  return Response.json({ data: validated })
}
\`\`\`

## Field Conventions

### IDs

- Type: UUID (RFC 4122)
- Generated server-side
- Never expose internal details
- Example: `550e8400-e29b-41d4-a716-446655440000`

### Prices

- Type: Number (integer, paise/cents)
- Never use decimals
- Store as: ₹100 = 10000
- Display as: 10000 / 100 = ₹100.00

### Timestamps

- Format: ISO 8601 UTC
- Example: `2024-11-25T10:30:00Z`
- Always use UTC timezone

### Status Fields

Use predefined enums:

\`\`\`typescript
OrderStatus: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "returned"
Availability: "In Stock" | "Out of Stock" | "Preorder"
Role: "user" | "admin"
\`\`\`

## Validation Errors

When validation fails, throw descriptive errors:

\`\`\`typescript
{
  "error": "ValidationError",
  "schema": "User",
  "messages": [
    "email: Invalid email format",
    "phone: Must be 10-15 digits"
  ]
}
\`\`\`

## Adding New Fields

When adding schema fields:

1. Update `lib/schema.ts` with Zod definition
2. Update `lib/types.ts` TypeScript types
3. Update mock data in `public/mock/*.json`
4. Update API handlers to validate new field
5. Update tests with new test cases
6. Document the new field in this file

## Maintaining Consistency

### Automated Checks

Run validators in:
- API route handlers (server)
- Form submissions (client)
- Mock data initialization (development)
- Tests (validation)

### Code Review Checklist

- [ ] New types added to `lib/schema.ts`
- [ ] Zod validators updated
- [ ] Mock data conforms to schema
- [ ] TypeScript compilation passes
- [ ] Runtime validation tests pass
- [ ] API responses validated
- [ ] Documentation updated

## Examples

### Valid Product

\`\`\`json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "CustomForge Shadow RTX 4070",
  "category": "GPU",
  "brand": "NVIDIA",
  "originalPrice": 54900,
  "discountPercentage": 10,
  "finalPrice": 49410,
  "stock": 25,
  "availability": "In Stock",
  "images": ["https://..."],
  "description": "High-end GPU",
  "ratings": { "average": 4.7, "totalReviews": 214 },
  "sku": "CF-GPU-4070",
  "isActive": true,
  "isFeatured": true,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
\`\`\`

### Invalid Product

\`\`\`json
{
  "name": "Product",
  "price": 100,           // ❌ Wrong field name (should be originalPrice)
  "category": "",         // ❌ Empty string
  "ratings": 4.5          // ❌ Should be object with {average, totalReviews}
}
\`\`\`

## References

- Database Schema: See `schema.sql`
- TypeScript Types: See `lib/schema.ts`
- Validators: See `lib/schema-validation.ts`
- Mock Data: See `public/mock/`
