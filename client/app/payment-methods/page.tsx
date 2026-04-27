"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserService } from "@/services/user-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Plus, Trash2, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTwoFactorModal } from "@/components/two-factor-modal";

export default function PaymentMethodsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const queryClient = useQueryClient();
  const { requestTwoFactor, TwoFactorModal } = useTwoFactorModal();

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    cardNumber: "",
    cardName: "",
    expMonth: "",
    expYear: "",
    cvv: "",
  });

  // Fetch payment methods
  const { data: paymentMethodsResponse, isLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => UserService.getPaymentMethods(),
  });

  const paymentMethods = paymentMethodsResponse?.data || [];

  // Add payment method mutation
  const addPaymentMethodMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = await requestTwoFactor();
      if (!token) throw new Error("2FA verification required");
      return UserService.addPaymentMethod(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      toast.success("Payment method added successfully");
      resetForm();
    },
  });

  // Delete payment method mutation
  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await requestTwoFactor();
      if (!token) throw new Error("2FA verification required");
      return UserService.deletePaymentMethod(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      toast.success("Payment method deleted successfully");
    },
  });

  // Set default payment method mutation
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => UserService.setDefaultPaymentMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      toast.success("Default payment method updated");
    },
  });

  const resetForm = () => {
    setFormData({
      cardNumber: "",
      cardName: "",
      expMonth: "",
      expYear: "",
      cvv: "",
    });
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await addPaymentMethodMutation.mutateAsync({
        type: "card",
        cardNumber: formData.cardNumber.replace(/\s/g, ""),
        cardName: formData.cardName,
        expMonth: parseInt(formData.expMonth),
        expYear: parseInt(formData.expYear),
        cvv: formData.cvv,
      });

      if (response.error) {
        toast.error(response.error.message || "Failed to add payment method");
      }
    } catch (error: any) {
      if (error.message !== "2FA verification required") {
        toast.error("An error occurred");
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment method?")) {
      return;
    }

    try {
      const response = await deletePaymentMethodMutation.mutateAsync(id);
      if (response.error) {
        toast.error(
          response.error.message || "Failed to delete payment method"
        );
      }
    } catch (error: any) {
      if (error.message !== "2FA verification required") {
        toast.error("An error occurred");
      }
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await setDefaultMutation.mutateAsync(id);
      if (response.error) {
        toast.error(
          response.error.message || "Failed to set default payment method"
        );
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const maskCardNumber = (last4: string) => `•••• •••• •••• ${last4}`;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl">Payment Methods</h1>
        {redirectTo && (
          <Button variant="outline" onClick={() => router.push(redirectTo)}>
            Back to Checkout
          </Button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add New Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="cardNumber">Card Number *</Label>
                <Input
                  id="cardNumber"
                  value={formData.cardNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    const formatted =
                      value.match(/.{1,4}/g)?.join(" ") || value;
                    setFormData({ ...formData, cardNumber: formatted });
                  }}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  required
                />
              </div>

              <div>
                <Label htmlFor="cardName">Cardholder Name *</Label>
                <Input
                  id="cardName"
                  value={formData.cardName}
                  onChange={(e) =>
                    setFormData({ ...formData, cardName: e.target.value })
                  }
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="expMonth">Exp Month *</Label>
                  <Input
                    id="expMonth"
                    type="number"
                    min="1"
                    max="12"
                    value={formData.expMonth}
                    onChange={(e) =>
                      setFormData({ ...formData, expMonth: e.target.value })
                    }
                    placeholder="MM"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="expYear">Exp Year *</Label>
                  <Input
                    id="expYear"
                    type="number"
                    min={new Date().getFullYear()}
                    value={formData.expYear}
                    onChange={(e) =>
                      setFormData({ ...formData, expYear: e.target.value })
                    }
                    placeholder="YYYY"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="cvv">CVV *</Label>
                  <Input
                    id="cvv"
                    type="text"
                    maxLength={4}
                    value={formData.cvv}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setFormData({ ...formData, cvv: value });
                    }}
                    placeholder="123"
                    required
                  />
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  2FA verification will be required to add this payment method.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={addPaymentMethodMutation.isPending}
                >
                  Add Payment Method
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Add Button */}
      {!isAdding && (
        <Button onClick={() => setIsAdding(true)} className="mb-6">
          <Plus className="h-4 w-4 mr-2" />
          Add New Payment Method
        </Button>
      )}

      {/* Payment Methods List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : paymentMethods.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No payment methods found. Add your first payment method above.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {paymentMethods.map((method) => (
            <Card key={method.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {method.brand?.toUpperCase()}{" "}
                        {maskCardNumber(method.last4 || "****")}
                        {method.isDefault && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Expires {method.expMonth}/{method.expYear}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={setDefaultMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(method.id)}
                      disabled={deletePaymentMethodMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TwoFactorModal />
    </div>
  );
}
