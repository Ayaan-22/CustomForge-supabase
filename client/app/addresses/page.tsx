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
import { AlertCircle, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTwoFactorModal } from "@/components/two-factor-modal";
import type { Address } from "@/lib/types";

export default function AddressesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const queryClient = useQueryClient();
  const { requestTwoFactor, TwoFactorModal } = useTwoFactorModal();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  // Fetch addresses
  const { data: addressesResponse, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => UserService.getAddresses(),
  });

  const addresses = addressesResponse?.data || [];

  // Add address mutation
  const addAddressMutation = useMutation({
    mutationFn: (data: {
      fullName: string;
      phoneNumber: string;
      address: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    }) => UserService.addAddress(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address added successfully");
      resetForm();
    },
  });

  // Update address mutation
  const updateAddressMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        fullName: string;
        phoneNumber: string;
        address: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      };
    }) => UserService.updateAddress(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address updated successfully");
      resetForm();
    },
  });

  // Delete address mutation
  const deleteAddressMutation = useMutation({
    mutationFn: (id: string) => UserService.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address deleted successfully");
    },
  });

  // Set default address mutation
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => UserService.setDefaultAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Default address updated");
    },
  });

  const resetForm = () => {
    setFormData({
      fullName: "",
      phoneNumber: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Request 2FA for updates
    if (editingId) {
      const token = await requestTwoFactor();
      if (!token) {
        toast.error("2FA verification required");
        return;
      }
    }

    try {
      // Combine line1 and line2 into single address field as per schema
      const addressData = {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        address: formData.line2 ? `${formData.line1}, ${formData.line2}` : formData.line1,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country,
      };

      if (editingId) {
        const response = await updateAddressMutation.mutateAsync({
          id: editingId,
          data: addressData,
        });
        if (response.error) {
          toast.error(response.error.message || "Failed to update address");
        }
      } else {
        const response = await addAddressMutation.mutateAsync(addressData);
        if (response.error) {
          toast.error(response.error.message || "Failed to add address");
        }
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleEdit = (address: Address) => {
    // Split address back into line1 and line2 if it contains a comma
    const addressParts = address.address?.split(", ") || [address.line1 || ""];
    setFormData({
      fullName: address.fullName || "",
      phoneNumber: address.phoneNumber || "",
      line1: addressParts[0] || address.line1 || "",
      line2: addressParts[1] || address.line2 || "",
      city: address.city,
      state: address.state || "",
      postalCode: address.postalCode,
      country: address.country,
    });
    setEditingId(address.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error("Cannot delete default address");
      return;
    }

    if (!confirm("Are you sure you want to delete this address?")) {
      return;
    }

    try {
      const response = await deleteAddressMutation.mutateAsync(id);
      if (response.error) {
        toast.error(response.error.message || "Failed to delete address");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await setDefaultMutation.mutateAsync(id);
      if (response.error) {
        toast.error(response.error.message || "Failed to set default address");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl">Shipping Addresses</h1>
        {redirectTo && (
          <Button variant="outline" onClick={() => router.push(redirectTo)}>
            Back to Checkout
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {editingId ? "Edit Address" : "Add New Address"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="line1">Address Line 1 *</Label>
                <Input
                  id="line1"
                  value={formData.line1}
                  onChange={(e) =>
                    setFormData({ ...formData, line1: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="line2">Address Line 2</Label>
                <Input
                  id="line2"
                  value={formData.line2}
                  onChange={(e) =>
                    setFormData({ ...formData, line2: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postalCode">Postal Code *</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    addAddressMutation.isPending ||
                    updateAddressMutation.isPending
                  }
                >
                  {editingId ? "Update Address" : "Add Address"}
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
          Add New Address
        </Button>
      )}

      {/* Addresses List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No addresses found. Add your first shipping address above.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">
                      {address.fullName}
                      {address.isDefault && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {address.address}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {address.city}, {address.state} {address.postalCode}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {address.country}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {address.phoneNumber}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!address.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(address.id)}
                        disabled={setDefaultMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(address)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDelete(address.id, address.isDefault || false)
                      }
                      disabled={deleteAddressMutation.isPending}
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
