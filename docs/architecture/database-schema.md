# 🗄️ Database Schema & Data Models

This document defines the authoritative data schema for the CustomForge platform. It ensures consistency across the database, API layer, and frontend state.

## 📌 Architecture Overview

CustomForge uses **Supabase (PostgreSQL)** for data persistence. The schema is designed for performance, type safety, and scalability.

- **Type Safety**: Enforced via TypeScript interfaces.
- **Runtime Validation**: Managed by **Zod** for API requests and environment variables.
- **Single Source of Truth**: Centralized definitions in `@/lib/schema.ts`.

---

## 👤 Core Entities

### Users

The central entity for authentication and profile management.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Unique identifier (Primary Key) |
| `name` | `string` | User's full display name |
| `email` | `string` | Unique email address (Verified) |
| `role` | `enum` | `"user"` or `"admin"` |
| `isEmailVerified` | `boolean` | Verification status |
| `twoFactorEnabled` | `boolean` | MFA status |
| `active` | `boolean` | Account status (soft-delete support) |

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
  phone?: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  active: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

---

### 📦 Products & Inventory

Detailed specifications for gaming hardware and pre-built systems.

| Category | Key Fields |
| :--- | :--- |
| **Identity** | `id`, `name`, `sku`, `brand`, `category` |
| **Pricing** | `originalPrice`, `discountPercentage`, `finalPrice` |
| **Inventory** | `stock`, `availability` (`In Stock`, `Out of Stock`) |
| **Metadata** | `images[]`, `description`, `features[]`, `warranty` |
| **Metrics** | `ratings.average`, `ratings.totalReviews`, `salesCount` |

> [!IMPORTANT]
> **Pricing Convention**: All prices are stored as **integers in paise/cents** to avoid floating-point errors.
> Example: ₹499.00 is stored as `49900`.

---

### 🛒 Orders

Transactional records for customer purchases.

| Field | Description |
| :--- | :--- |
| `status` | `pending`, `paid`, `shipped`, `delivered`, `cancelled`, `returned` |
| `shippingAddress` | JSONB object containing verified shipping details |
| `itemsPrice` | Subtotal before taxes and shipping |
| `totalPrice` | Final amount charged to the customer |
| `isPaid` | Boolean flag for payment confirmation |

---

## 🛡️ Validation & Compliance

### 1. Schema Validation (Zod)

All external data must pass validation before being processed by the system.

```typescript
import { ProductSchema } from "@/lib/schema";

// Validate API response
const result = ProductSchema.safeParse(data);
if (!result.success) {
  console.error("Validation failed:", result.error.format());
}
```

### 2. Consistency Rules

- **IDs**: Must use RFC 4122 compliant UUIDs.
- **Timestamps**: Always stored in UTC (ISO 8601).
- **Enums**: Use strictly defined string literals for status and roles.

---

## 🔄 Updating the Schema

When adding or modifying fields, follow this workflow:

1. **Database**: Update the migration script in `server/models/migrations/`.
2. **Types**: Update definitions in `lib/schema.ts`.
3. **Validators**: Update Zod schemas in `lib/schema-validation.ts`.
4. **Mock Data**: Sync JSON files in `public/mock/`.
5. **Documentation**: Update this file and any relevant API references.

---

## 📖 Examples

### Valid Product Payload

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Shadow RTX 4070 Ti Super",
  "category": "GPU",
  "brand": "NVIDIA",
  "originalPrice": 82900,
  "discountPercentage": 5,
  "finalPrice": 78755,
  "stock": 12,
  "availability": "In Stock",
  "sku": "CF-GPU-4070TIS",
  "isActive": true,
  "createdAt": "2024-03-20T14:30:00Z"
}
```
