"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { AuthService } from "@/services/auth-service";
import { useToast } from "@/hooks/use-toast";

export default function SecurityPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, refetchUser } = useAuth();
  const [enabling2FA, setEnabling2FA] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [passwordForEnable, setPasswordForEnable] = useState("");
  const [passwordForDisable, setPasswordForDisable] = useState("");
  const [tokenForDisable, setTokenForDisable] = useState("");
  const [showEnablePassword, setShowEnablePassword] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);

  async function handleEnable2FA() {
    if (!passwordForEnable) {
      toast({
        title: "Error",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    setEnabling2FA(true);
    const res = await AuthService.enable2fa({ password: passwordForEnable });
    if (res.error) {
      toast({
        title: "Error",
        description: res.error.message,
        variant: "destructive",
      });
      setEnabling2FA(false);
      return;
    }
    if (res.data?.otpauthUrl) {
      setQrCode(res.data.otpauthUrl);
      setShowEnablePassword(false);
      setPasswordForEnable("");
    }
  }

  async function handleVerify2FA() {
    const res = await AuthService.verify2fa({ token: verifyCode });
    if (res.error) {
      toast({
        title: "Error",
        description: res.error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Success",
      description: "Two-factor authentication enabled",
    });
    setQrCode(null);
    setEnabling2FA(false);
    setVerifyCode("");
    // Refresh user
    refetchUser();
  }

  async function handleDisable2FA() {
    if (!passwordForDisable || !tokenForDisable) {
      toast({
        title: "Error",
        description: "Please enter your password and 2FA code",
        variant: "destructive",
      });
      return;
    }

    setDisabling2FA(true);
    const res = await AuthService.disable2fa({
      password: passwordForDisable,
      token: tokenForDisable,
    });
    if (res.error) {
      toast({
        title: "Error",
        description: res.error.message,
        variant: "destructive",
      });
      setDisabling2FA(false);
      return;
    }
    toast({
      title: "Success",
      description: "Two-factor authentication disabled",
    });
    setShowDisableForm(false);
    setPasswordForDisable("");
    setTokenForDisable("");
    setDisabling2FA(false);
    // Refresh user
    refetchUser();
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading mb-6 text-2xl">Security settings</h1>

      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Two-factor authentication</h2>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Switch
              checked={user.twoFactorEnabled || false}
              onCheckedChange={(checked) => {
                if (checked) {
                  setShowEnablePassword(true);
                } else {
                  setShowDisableForm(true);
                }
              }}
            />
          </div>

          {showEnablePassword && !qrCode && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <p className="text-sm">
                Enter your password to enable two-factor authentication:
              </p>
              <div className="space-y-2">
                <Label htmlFor="passwordForEnable">Password</Label>
                <Input
                  id="passwordForEnable"
                  type="password"
                  value={passwordForEnable}
                  onChange={(e) => setPasswordForEnable(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEnable2FA} disabled={enabling2FA}>
                  {enabling2FA ? "Processing..." : "Continue"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEnablePassword(false);
                    setPasswordForEnable("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {qrCode && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <p className="text-sm">
                Scan this QR code with your authenticator app:
              </p>
              <img
                src={qrCode || "/placeholder.svg"}
                alt="QR Code"
                className="mx-auto h-48 w-48"
              />
              <div className="space-y-2">
                <Label htmlFor="verifyCode">Enter 6-digit code</Label>
                <Input
                  id="verifyCode"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  maxLength={6}
                  placeholder="000000"
                />
              </div>
              <Button
                onClick={handleVerify2FA}
                disabled={verifyCode.length !== 6}
              >
                Verify and enable
              </Button>
            </div>
          )}

          {showDisableForm && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <p className="text-sm">
                Enter your password and 2FA code to disable two-factor
                authentication:
              </p>
              <div className="space-y-2">
                <Label htmlFor="passwordForDisable">Password</Label>
                <Input
                  id="passwordForDisable"
                  type="password"
                  value={passwordForDisable}
                  onChange={(e) => setPasswordForDisable(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tokenForDisable">2FA Code</Label>
                <Input
                  id="tokenForDisable"
                  value={tokenForDisable}
                  onChange={(e) => setTokenForDisable(e.target.value)}
                  maxLength={6}
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDisable2FA} disabled={disabling2FA}>
                  {disabling2FA ? "Processing..." : "Disable 2FA"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDisableForm(false);
                    setPasswordForDisable("");
                    setTokenForDisable("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-2 font-semibold">Password</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Change your password to keep your account secure
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/profile/change-password")}
          >
            Change password
          </Button>
        </Card>
      </div>
    </div>
  );
}
