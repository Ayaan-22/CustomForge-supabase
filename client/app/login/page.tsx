"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthService } from "@/services/auth-service";
import { useToast } from "@/hooks/use-toast";
import { storeAuthTokens } from "@/lib/apiClient";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = React.useState(false);
  const [twoFactorToken, setTwoFactorToken] = React.useState("");
  const [formData, setFormData] = React.useState({
    email: "",
    password: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = requiresTwoFactor
        ? { ...formData, twoFactorToken }
        : formData;

      const res = await AuthService.login(payload);

      if (res.error) {
        if (res.error.is2FARequired) {
          setRequiresTwoFactor(true);
          toast({
            title: "Two-Factor Authentication Required",
            description: "Please enter the code from your authenticator app.",
          });
        } else {
          toast({
            title: "Sign in failed",
            description: res.error.message,
            variant: "destructive",
          });
        }
        return;
      }

      if (res.data) {
        storeAuthTokens({
          token: res.data.token,
          user: res.data.user,
        });
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
        router.push("/profile");
      }
    } catch (error) {
      toast({
        title: "An error occurred",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto grid place-items-center px-4 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-md border bg-card/60 p-6"
      >
        <h1 className="font-heading text-2xl">
          {requiresTwoFactor ? "Two-Factor Authentication" : "Sign in"}
        </h1>

        {!requiresTwoFactor ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="twoFactorToken">Authentication Code</Label>
            <Input
              id="twoFactorToken"
              type="text"
              placeholder="Enter 6-digit code"
              value={twoFactorToken}
              onChange={(e) => setTwoFactorToken(e.target.value)}
              required
              autoFocus
              disabled={isLoading}
              maxLength={6}
            />
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              onClick={() => setRequiresTwoFactor(false)}
              disabled={isLoading}
            >
              Back to Login
            </Button>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading
            ? "Signing in..."
            : requiresTwoFactor
            ? "Verify"
            : "Sign in"}
        </Button>

        {!requiresTwoFactor && (
          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary">
              Register
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
