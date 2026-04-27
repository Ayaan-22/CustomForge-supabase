"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthService } from "@/services/auth-service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, isEmailVerified, refetchUser } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // If already verified, redirect to home
  if (isEmailVerified) {
    router.push("/");
    return null;
  }

  const handleResendEmail = async () => {
    setIsResending(true);
    setMessage(null);

    try {
      const response = await AuthService.sendVerificationEmail();
      if (response.error) {
        setMessage({
          type: "error",
          text: response.error.message || "Failed to send verification email",
        });
      } else {
        setMessage({
          type: "success",
          text: "Verification email sent! Please check your inbox.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred. Please try again.",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
            </div>
            <CardTitle className="text-2xl">Verify Your Email</CardTitle>
            <CardDescription>
              We've sent a verification email to{" "}
              <span className="font-semibold text-foreground">
                {user?.email}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Please check your email and click the verification link to
                activate your account.
              </p>
              <p>You need to verify your email before you can:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Add items to your cart</li>
                <li>Create a wishlist</li>
                <li>Place orders</li>
                <li>Leave reviews</li>
              </ul>
            </div>

            {message && (
              <Alert
                className={
                  message.type === "success"
                    ? "bg-green-50 border-green-200 dark:bg-green-900/20"
                    : "bg-red-50 border-red-200 dark:bg-red-900/20"
                }
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription
                  className={
                    message.type === "success"
                      ? "text-green-800 dark:text-green-200"
                      : "text-red-800 dark:text-red-200"
                  }
                >
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Button
                onClick={handleResendEmail}
                disabled={isResending}
                className="w-full"
                variant="outline"
              >
                {isResending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isResending ? "Sending..." : "Resend Verification Email"}
              </Button>

              <Button
                onClick={() => refetchUser()}
                variant="ghost"
                className="w-full"
              >
                I've Verified My Email
              </Button>
            </div>

            <div className="text-xs text-center text-muted-foreground">
              Didn't receive the email? Check your spam folder or try resending.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
