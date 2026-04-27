"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/hooks/use-cart";
import { UserService } from "@/services/user-service";
import { OrderService } from "@/services/order-service";
import { CartService } from "@/services/cart-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Plus, Banknote } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { Address, PaymentMethod } from "@/lib/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, isEmailVerified } = useAuth();
  const { items, subtotal, clear } = useCart();

  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] =
    useState<string>("");
  const [selectedPaymentType, setSelectedPaymentType] = useState<"saved" | "cod">("saved");
  const [couponCode, setCouponCode] = useState("");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // Fetch addresses
  const { data: addressesResponse, isLoading: loadingAddresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => UserService.getAddresses(),
    enabled: isAuthenticated,
  });

  // Fetch payment methods
  const { data: paymentMethodsResponse, isLoading: loadingPaymentMethods } =
    useQuery({
      queryKey: ["payment-methods"],
      queryFn: () => UserService.getPaymentMethods(),
      enabled: isAuthenticated,
    });

  const addresses = addressesResponse?.data || [];
  const paymentMethods = paymentMethodsResponse?.data || [];

  // Redirect if not authenticated or verified
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!isEmailVerified) {
      router.push("/verify-email");
      return;
    }

    // Redirect if cart is empty
    if (items.length === 0) {
      router.push("/cart");
      return;
    }
  }, [isAuthenticated, isEmailVerified, items.length, router]);

  // Show loading/redirect state while checking
  if (!isAuthenticated || !isEmailVerified || items.length === 0) {
    return null;
  }

  const handleCreateOrder = async () => {
    if (!selectedAddressId) {
      toast.error("Please select a shipping address", {
        duration: 5000,
      });
      return;
    }

    if (selectedPaymentType === "saved" && !selectedPaymentMethodId) {
      toast.error("Please select a payment method", {
        duration: 5000,
      });
      return;
    }

    setIsCreatingOrder(true);

    try {
      // Sync local cart items to backend database
      // This ensures the backend has the cart items when creating the order
      // Clear backend cart first to avoid duplicates
      try {
        await CartService.clear();
      } catch (error) {
        // Ignore clear errors - cart might not exist yet
        console.warn("Failed to clear backend cart:", error);
      }

      // Add all items to backend cart
      for (const item of items) {
        try {
          await CartService.add({
            productId: item.product.id,
            quantity: item.quantity,
          });
        } catch (error) {
          // If sync fails, show error and stop
          toast.error(`Failed to sync cart item: ${item.product.name}`, {
            duration: 5000,
          });
          setIsCreatingOrder(false);
          return;
        }
      }

      const paymentMethod = selectedPaymentType === "cod" ? "cod" : "stripe";
      
      const response = await OrderService.create({
        shippingAddressId: selectedAddressId,
        paymentMethod: paymentMethod,
        idempotencyKey: `order-${Date.now()}`,
      });

      if (response.error) {
        toast.error(response.error.message || "Failed to create order", {
          duration: 5000,
        });
        setIsCreatingOrder(false);
        return;
      }

      // Clear cart (both local and backend)
      clear();
      try {
        await CartService.clear();
      } catch (error) {
        // Ignore clear errors
        console.warn("Failed to clear backend cart:", error);
      }

      // Redirect based on payment method
      const orderId = response.data?.order?.id;
      if (orderId) {
        if (paymentMethod === "cod") {
          toast.success("Order placed successfully! You will pay on delivery.", {
            duration: 5000,
          });
          // Delay redirect to ensure toast is visible
          setTimeout(() => {
            router.push(`/orders/${orderId}?success=true`);
          }, 500);
        } else {
          toast.success("Order created! Redirecting to payment...", {
            duration: 5000,
          });
          // Delay redirect to ensure toast is visible
          setTimeout(() => {
            router.push(`/orders/${orderId}/payment`);
          }, 500);
        }
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.", {
        duration: 5000,
      });
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="font-heading text-3xl mb-6">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Shipping Address
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/addresses?redirect=/checkout")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAddresses ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : addresses.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No addresses found. Please add a shipping address.
                  </AlertDescription>
                </Alert>
              ) : (
                <RadioGroup
                  value={selectedAddressId}
                  onValueChange={setSelectedAddressId}
                >
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className="flex items-start space-x-2 border rounded-lg p-3"
                    >
                      <RadioGroupItem
                        value={address.id}
                        id={`address-${address.id}`}
                      />
                      <Label
                        htmlFor={`address-${address.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">
                          {address.line1}
                          {address.isDefault && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        {address.line2 && (
                          <div className="text-sm text-muted-foreground">
                            {address.line2}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          {address.city}, {address.state} {address.postalCode}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {address.country}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Payment Method
                {selectedPaymentType === "saved" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push("/payment-methods?redirect=/checkout")
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={selectedPaymentType === "cod" ? "cod" : selectedPaymentMethodId}
                onValueChange={(value) => {
                  if (value === "cod") {
                    setSelectedPaymentType("cod");
                    setSelectedPaymentMethodId("cod");
                  } else {
                    setSelectedPaymentMethodId(value);
                    setSelectedPaymentType("saved");
                  }
                }}
                className="space-y-4"
              >
                {/* Cash on Delivery Option */}
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

                {/* Saved Payment Methods */}
                {loadingPaymentMethods ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No payment methods found. Please add a payment method or use Cash on Delivery.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="text-sm font-medium text-muted-foreground">
                      Or use a saved payment method:
                    </div>
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className="flex items-start space-x-2 border rounded-lg p-3"
                      >
                        <RadioGroupItem
                          value={method.id}
                          id={`payment-${method.id}`}
                        />
                        <Label
                          htmlFor={`payment-${method.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium">
                            {method.brand?.toUpperCase()} •••• {method.last4}
                            {method.isDefault && (
                              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Expires {method.expMonth}/{method.expYear}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </>
                )}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Coupon Code */}
          <Card>
            <CardHeader>
              <CardTitle>Coupon Code</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                />
                <Button variant="outline">Apply</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {items.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {product.name} × {quantity}
                    </span>
                    <span>
                      {formatPrice(
                        (product.finalPrice || product.originalPrice) * quantity
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Shipping</span>
                  <span>Calculated at payment</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleCreateOrder}
                disabled={
                  isCreatingOrder ||
                  !selectedAddressId ||
                  (selectedPaymentType === "saved" && !selectedPaymentMethodId)
                }
              >
                {isCreatingOrder ? "Creating Order..." : "Place Order"}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By placing your order, you agree to our terms and conditions
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
