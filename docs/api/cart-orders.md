# 🛒 Cart & Order Processing Logic

CustomForge implements a sophisticated checkout system that balances user experience with strict business logic and data integrity.

## 🛍️ Cart: Preview Mode

The Shopping Cart serves as a **non-binding preview**. Users can add items, update quantities, and apply coupons without affecting inventory or permanent state.

### Key Characteristics

- **Soft Validation**: Coupons are checked for existence and general status (active/inactive).
- **Price Calculation**: Discounts are shown as *estimates*.
- **No Stock Locking**: Adding an item to the cart does *not* deduct stock or reserve the item.
- **Dynamic Updates**: Totals are recalculated on every item modification.

---

## 🧾 Checkout: Strict Validation Mode

When a user initiates an order (`POST /orders`), the system switches from "Preview" to **"Strict Validation"**.

### The Atomic Transaction Flow

To ensure data consistency, order creation follows a strict atomic sequence. If any step fails, the entire transaction is rolled back.

1. **Coupon Integrity**: Re-validates start/end dates, minimum order values, and global usage limits.
2. **Stock Verification**: Checks real-time stock levels for all items.
3. **Inventory Deduction**: Atomically decrements stock levels.
4. **Coupon Consumption**: Increments usage count for the applied coupon.
5. **Order Creation**: Records the order and line items in the database.
6. **Cart Clearing**: Flushes the user's active cart upon success.

> [!CAUTION]
> **Idempotency**: The system implements idempotency keys to prevent duplicate order creation from accidental double-clicks or network retries.

---

## 💳 Payment Lifecycle

CustomForge supports multiple payment methods with distinct workflows:

| Method | Workflow |
| :--- | :--- |
| **Stripe** | Redirect to Hosted Checkout → Webhook Confirmation → Order Paid |
| **PayPal** | Client-side Capture → Backend Verification → Order Paid |
| **COD** | Order Confirmed → Manual Fulfillment → Marked Paid on Delivery |

### Order Status Mapping

- `pending`: Order created, awaiting payment.
- `paid`: Payment confirmed by gateway.
- `shipped`: Dispatched via logistics.
- `delivered`: Reached the customer.
- `cancelled`: Terminated by user or system (stock is automatically replenished).

---

## 🏷️ Coupon Rules engine

Our coupon system supports complex targeting:

- **Global Limits**: Total number of times a coupon can be used.
- **User Limits**: Number of times a specific user can use a coupon.
- **Category Specific**: Discounts restricted to specific product types (e.g., "GPUs only").
- **Product Specific**: Discounts for individual items.
- **Minimum Value**: Enforced at the checkout level.

---

## 🔄 Returns & Refunds

1. **Request**: User requests a return via `POST /orders/request-return/:id`.
2. **Approval**: Admin reviews and approves/denies.
3. **Refund**: Once approved, the payment gateway processes the refund, and the order status is updated to `returned`.
4. **Inventory**: System optionally restocks the returned items based on condition.
