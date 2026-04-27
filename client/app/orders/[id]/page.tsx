"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OrderService } from "@/services/order-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Package,
  MapPin,
  CreditCard,
  XCircle,
  RotateCcw,
  CheckCircle,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export default function OrderDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Check if user arrived from successful order creation
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setShowSuccessBanner(true);
      // Auto-hide banner after 10 seconds
      const timer = setTimeout(() => {
        setShowSuccessBanner(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const {
    data: orderResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => OrderService.get(orderId),
  });

  const order = orderResponse?.data;

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: () => OrderService.cancel(orderId),
    onSuccess: (response) => {
      if (response.error) {
        toast.error(response.error.message || "Failed to cancel order");
      } else {
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        toast.success("Order cancelled successfully");
      }
    },
  });

  // Request return mutation
  const returnOrderMutation = useMutation({
    mutationFn: () => OrderService.return(orderId),
    onSuccess: (response) => {
      if (response.error) {
        toast.error(response.error.message || "Failed to request return");
      } else {
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        toast.success("Return request submitted successfully");
      }
    },
  });

  const handleCancelOrder = () => {
    if (!confirm("Are you sure you want to cancel this order?")) {
      return;
    }
    cancelOrderMutation.mutate();
  };

  const handleRequestReturn = () => {
    if (!confirm("Are you sure you want to request a return for this order?")) {
      return;
    }
    returnOrderMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "shipped":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "paid":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      case "cancelled":
      case "returned":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load order details. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const canCancel = order.status === "pending";
  const canReturn = order.status === "delivered";

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Success Banner */}
      {showSuccessBanner && (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-300">
            <div className="font-semibold mb-2">Order placed successfully!</div>
            <div className="text-sm mb-3">
              Your order has been confirmed. Order #{order.id.slice(0, 8)}
            </div>
            {/* Pricing Breakdown */}
            <div className="text-sm space-y-1 bg-white/50 dark:bg-black/20 rounded-md p-3 border border-green-200 dark:border-green-800">
              <div className="font-medium mb-2">Order Summary:</div>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">
                  {formatPrice(order.subtotal || 0)}
                </span>
              </div>
              {order.discount && order.discount > 0 && (
                <div className="flex justify-between text-green-700 dark:text-green-400">
                  <span>Discount:</span>
                  <span className="font-medium">
                    -{formatPrice(order.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-green-200 dark:border-green-800">
                <span className="font-semibold">Total:</span>
                <span className="font-semibold">
                  {formatPrice(order.total || 0)}
                </span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl">Order Details</h1>
          <p className="text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
            order.status
          )}`}
        >
          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between pb-4 border-b last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium">
                      {item.name || `Item ${index + 1}`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Quantity: {item.quantity}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatPrice((item.price || 0) * item.quantity)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatPrice(item.price || 0)} each
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {order.address && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div className="font-medium">{order.address.fullName}</div>
                  <div>{order.address.address}</div>
                  <div>
                    {order.address.city}, {order.address.state}{" "}
                    {order.address.postalCode}
                  </div>
                  <div>{order.address.country}</div>
                  <div>{order.address.phoneNumber}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {(canCancel || canReturn) && (
            <Card>
              <CardHeader>
                <CardTitle>Order Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {canCancel && (
                  <Button
                    variant="destructive"
                    onClick={handleCancelOrder}
                    disabled={cancelOrderMutation.isPending}
                    className="w-full"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {cancelOrderMutation.isPending
                      ? "Cancelling..."
                      : "Cancel Order"}
                  </Button>
                )}
                {canReturn && (
                  <Button
                    variant="outline"
                    onClick={handleRequestReturn}
                    disabled={returnOrderMutation.isPending}
                    className="w-full"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {returnOrderMutation.isPending
                      ? "Requesting..."
                      : "Request Return"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatPrice(order.subtotal || 0)}</span>
                </div>
                {order.discount && order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatPrice(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatPrice(order.total || 0)}</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <div>Order ID: {order.id}</div>
                <div>
                  Placed:{" "}
                  {order.createdAt &&
                    formatDistanceToNow(new Date(order.createdAt), {
                      addSuffix: true,
                    })}
                </div>
                {order.paymentIntentId && (
                  <div>Payment ID: {order.paymentIntentId.slice(0, 16)}...</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
