"use client";

import { useState } from "react";
import { AuthService } from "@/services/auth-service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, AlertCircle } from "lucide-react";

type TwoFactorModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
  title?: string;
  description?: string;
};

export function TwoFactorModal({
  open,
  onClose,
  onSuccess,
  title = "Two-Factor Authentication Required",
  description = "This action requires two-factor authentication. Please enter your 6-digit code.",
}: TwoFactorModalProps) {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await AuthService.verify2fa({ token: code });

      if (response.error) {
        setError(response.error.message || "Invalid code. Please try again.");
      } else {
        // Success - pass the code to the parent
        onSuccess(code);
        handleClose();
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setCode("");
    setError(null);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="2fa-code">Authentication Code</Label>
            <Input
              id="2fa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setCode(value);
                setError(null);
              }}
              onKeyPress={handleKeyPress}
              className="text-center text-2xl tracking-widest font-mono"
              autoFocus
              disabled={isVerifying}
            />
            <p className="text-xs text-muted-foreground text-center">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="sm:justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isVerifying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying || code.length !== 6}
          >
            {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isVerifying ? "Verifying..." : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for using the 2FA modal
export function useTwoFactorModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [resolveCallback, setResolveCallback] = useState<
    ((token: string | null) => void) | null
  >(null);

  const requestTwoFactor = (): Promise<string | null> => {
    return new Promise((resolve) => {
      setResolveCallback(() => resolve);
      setIsOpen(true);
    });
  };

  const handleSuccess = (token: string) => {
    if (resolveCallback) {
      resolveCallback(token);
      setResolveCallback(null);
    }
    setIsOpen(false);
  };

  const handleClose = () => {
    if (resolveCallback) {
      resolveCallback(null);
      setResolveCallback(null);
    }
    setIsOpen(false);
  };

  return {
    isOpen,
    requestTwoFactor,
    TwoFactorModal: () => (
      <TwoFactorModal
        open={isOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    ),
  };
}
