import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/types";

export function OrderPaymentAction({ order, compact = false }: {
  order: Pick<Order, "id" | "paymentMethod" | "isPaid" | "status">;
  compact?: boolean;
}) {
  // This only exposes navigation. The payment endpoint rechecks ownership,
  // settlement and the existing Stripe session before opening checkout.
  if (order.paymentMethod !== "stripe" || order.isPaid !== false ||
      !["pending", "processing"].includes(order.status)) return null;

  const button = (
    <Button asChild className={compact ? "" : "w-full sm:w-auto"}>
      <Link href={`/orders/${encodeURIComponent(order.id)}/payment`}>
        <CreditCard className="h-4 w-4" aria-hidden="true" />
        Continue to payment
      </Link>
    </Button>
  );

  if (compact) return button;
  return (
    <section aria-label="Order payment" className="mb-6 flex flex-col gap-4 rounded-xl border border-primary/30 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="font-semibold">Payment pending</h2>
        <p className="text-sm text-muted-foreground">Your order is saved. Continue to secure Stripe Checkout to complete payment.</p>
      </div>
      {button}
    </section>
  );
}
