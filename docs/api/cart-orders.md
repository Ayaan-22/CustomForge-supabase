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
| **PayPal** | Unavailable (503); no capture or settlement is implemented |
| **COD** | Order Confirmed → Manual Fulfillment → Marked Paid on Delivery |

### Order Status Mapping

- `pending`: Order created, awaiting payment.
- `paid`: Payment confirmed by gateway.
- `shipped`: Dispatched via logistics.
- `delivered`: Reached the customer.
- `cancelled`: Eligible unpaid COD cancellation or terminal unpaid Stripe recovery restores stock atomically. Arbitrary status edits are not proof of inventory restoration.
- `payment_review`: Payment was captured after inventory was released or requires reconciliation. Fulfillment and return actions are blocked until the merchant resolves the provider/order state.

New Stripe orders expose paymentExpiresAt, fixed at two hours after order creation. The storefront shows the remaining time and disables payment after expiry. Checkout retries keep the deadline and provider parameters unchanged. New Checkout must start with 31 minutes remaining; existing sessions can resume until expiry. The recovery worker scans at startup and every minute, expires abandoned open sessions, verifies unpaid state, then cancels the order and restores inventory, sales counts and coupon usage once. Unbound creation responses keep a five-minute reconciliation grace. Legacy missing customer identities use bounded account-wide provider discovery. Processing payments, provider outages and incomplete/ambiguous observations stay reserved. Late settlement shares the database order lock with release and is recorded as payment_review, preventing fulfillment after inventory release. COD has no Stripe payment deadline.

Order creation queues a confirmation email in its database transaction. A background outbox worker uses renewable leases and durable retry backoff. Checkout rollback creates no job; idempotent replay creates no duplicate job. SMTP delivery is at least once, so a crash between acceptance and acknowledgement can produce a duplicate email.

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
3. **Refund**: Provider refund initiation and complete ledger reconciliation remain unavailable. Signed Stripe refund webhooks record provider-observed outcomes.
4. **Inventory**: Completed returns/restocking reconciliation is outstanding; return approval alone does not refund money or restock items.
