"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { UserService } from "@/services/user-service";
import { AuthService } from "@/services/auth-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTwoFactorModal } from "@/components/two-factor-modal";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const { user, refetchUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const { requestTwoFactor, TwoFactorModal } = useTwoFactorModal();

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    avatar: user?.avatar || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      const token = await requestTwoFactor();
      if (!token) throw new Error("2FA verification required");
      return UserService.updateMe(data);
    },
    onSuccess: () => {
      refetchUser();
      toast.success("Profile updated successfully");
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordData) => {
      const token = await requestTwoFactor();
      if (!token) throw new Error("2FA verification required");
      return UserService.changePassword({
        passwordCurrent: data.currentPassword,
        password: data.newPassword,
        passwordConfirm: data.confirmPassword,
      });
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const token = await requestTwoFactor();
      if (!token) throw new Error("2FA verification required");

      if (
        !confirm(
          "Are you sure you want to delete your account? This action cannot be undone."
        )
      ) {
        throw new Error("Cancelled");
      }

      return UserService.deleteMe();
    },
    onSuccess: () => {
      toast.success("Account deleted successfully");
      logout();
    },
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await updateProfileMutation.mutateAsync(profileData);
      if (response.error) {
        toast.error(response.error.message || "Failed to update profile");
      }
    } catch (error: any) {
      if (error.message !== "2FA verification required") {
        toast.error("An error occurred");
      }
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      const response = await changePasswordMutation.mutateAsync(passwordData);
      if (response.error) {
        toast.error(response.error.message || "Failed to change password");
      }
    } catch (error: any) {
      if (error.message !== "2FA verification required") {
        toast.error("An error occurred");
      }
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await deleteAccountMutation.mutateAsync();
      if (response.error) {
        toast.error(response.error.message || "Failed to delete account");
      }
    } catch (error: any) {
      if (
        error.message !== "2FA verification required" &&
        error.message !== "Cancelled"
      ) {
        toast.error("An error occurred");
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="font-heading text-3xl mb-6">My Profile</h1>

      <div className="space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, name: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  2FA verification will be required to update your profile.
                </AlertDescription>
              </Alert>

              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending
                  ? "Updating..."
                  : "Update Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  2FA verification will be required to change your password.
                </AlertDescription>
              </Alert>

              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending
                  ? "Changing..."
                  : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete your account, there is no going back. Please be
              certain.
            </p>

            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                2FA verification will be required to delete your account.
              </AlertDescription>
            </Alert>

            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
            >
              {deleteAccountMutation.isPending
                ? "Deleting..."
                : "Delete Account"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <TwoFactorModal />
    </div>
  );
}
