"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { OrderService } from "@/services/order-service";
import { PaymentService } from "@/services/payment-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  CreditCard,
  Wallet,
  Banknote,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";

type PaymentMethod = "stripe" | "paypal" | "cod";

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("stripe");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "processing" | "success" | "failed"
  >("idle");

  // Fetch order details
  const { data: orderResponse, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => OrderService.get(orderId),
  });

  const order = orderResponse?.data?.order;

  // Poll payment status
  useEffect(() => {
    if (!order || order.status === "paid") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await OrderService.paymentStatus(orderId);
        if (response.data?.status === "paid") {
          setPaymentStatus("success");
          clearInterval(interval);
          setTimeout(() => {
            router.push(`/orders/${orderId}`);
          }, 2000);
        }
      } catch (error) {
        console.error("Failed to check payment status:", error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [order, orderId, router]);

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async (method: PaymentMethod) => {
      setIsProcessing(true);
      setPaymentStatus("processing");

      if (method === "stripe") {
        // Use the generic process method for Stripe
        return PaymentService.process({
          orderId,
          paymentMethod: "stripe",
          paymentData: { paymentMethodId: "pm_card_visa" }, // This would come from Stripe Elements
        });
      } else if (method === "paypal") {
        // For PayPal, first create the order, then capture it
        const createResponse = await PaymentService.createPayPalOrder({
          orderId,
        });
        if (createResponse.error || !createResponse.data?.paypalOrderId) {
          throw new Error("Failed to create PayPal order");
        }
        // In a real implementation, the user would approve the PayPal order here
        // Then we capture it
        return PaymentService.capturePayPalOrder({
          orderId,
          paypalOrderId: createResponse.data.paypalOrderId,
        });
      } else {
        // COD
        return PaymentService.createOrderCod({ orderId });
      }
    },
    onSuccess: (response) => {
      if (response.error) {
        toast.error(response.error.message || "Payment failed");
        setPaymentStatus("failed");
        setIsProcessing(false);
      } else {
        toast.success("Payment successful!");
        setPaymentStatus("success");
        setTimeout(() => {
          router.push(`/orders/${orderId}`);
        }, 2000);
      }
    },
    onError: () => {
      toast.error("An error occurred during payment");
      setPaymentStatus("failed");
      setIsProcessing(false);
    },
  });

  const handlePayment = () => {
    processPaymentMutation.mutate(selectedMethod);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Order not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  // If already paid, redirect
  if (order.status === "paid" && paymentStatus !== "success") {
    router.push(`/orders/${orderId}`);
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="font-heading text-3xl mb-6">Complete Payment</h1>

      {paymentStatus === "success" ? (
        <Card className="border-green-500">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="font-semibold text-2xl mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Your order has been confirmed. Redirecting to order details...
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Order Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.name || `Item ${index + 1}`} × {item.quantity}
                    </span>
                    <span>
                      {formatPrice((item.price || 0) * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-lg border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatPrice(order.total || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Selection */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={selectedMethod}
                onValueChange={(value) =>
                  setSelectedMethod(value as PaymentMethod)
                }
              >
                {/* Stripe */}
                <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="stripe" id="stripe" />
                  <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span className="font-medium">Credit/Debit Card</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Pay securely with Stripe
                    </p>
                  </Label>
                </div>

                {/* PayPal */}
                <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="paypal" id="paypal" />
                  <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">PayPal</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Pay with your PayPal account
                    </p>
                  </Label>
                </div>

                {/* Cash on Delivery */}
                <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="cod" id="cod" />
                  <Label htmlFor="cod" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Cash on Delivery</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Pay when you receive your order
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Stripe Card Input (if Stripe selected) */}
          {selectedMethod === "stripe" && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Card Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Stripe Elements integration would go here. For demo
                    purposes, clicking "Pay Now" will use a test card.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* PayPal Button (if PayPal selected) */}
          {selectedMethod === "paypal" && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>PayPal Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    PayPal SDK integration would go here. For demo purposes,
                    clicking "Pay Now" will simulate PayPal payment.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Payment Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePayment}
            disabled={isProcessing || paymentStatus === "processing"}
          >
            {isProcessing || paymentStatus === "processing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>Pay {formatPrice(order.total || 0)}</>
            )}
          </Button>

          {paymentStatus === "failed" && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Payment failed. Please try again or choose a different payment
                method.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
