"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, CheckCircle, XCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AdminAuthShell, getAdminAuthErrorMessage } from "@/components/admin-auth-shell";

export default function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const verify = async () => {
      try {
        await authClient.verifyEmail(token);
        setSuccess(true);
      } catch (err: unknown) {
        setError(getAdminAuthErrorMessage(err, "Failed to verify email"));
      } finally {
        setLoading(false);
      }
    };
    if (token) verify();
  }, [token]);

  return <AdminAuthShell eyebrow="Email confirmation" title={loading ? "Confirming your email" : success ? "Email verified" : "Verification unsuccessful"} description={loading ? "Please wait while we confirm your email address." : success ? "Your email address has been confirmed." : "We couldn't confirm this verification link."}>
    {loading ? <div className="faa-result" role="status"><span className="faa-result-icon"><Loader2 aria-hidden className="faa-spinning" /></span><h2>Checking your verification link</h2><p>This should only take a moment.</p></div> : success ? <div className="faa-result" role="status"><span className="faa-result-icon"><CheckCircle aria-hidden /></span><h2>One step complete</h2><p>You can now sign in to your CustomForge account. Access to the admin workspace requires separately assigned administrator permissions.</p><Link href="/login" className="faa-submit">Continue to sign in <ArrowRight aria-hidden /></Link></div> : <div className="faa-result"><span className="faa-result-icon is-error"><XCircle aria-hidden /></span><h2>This link couldn't be verified</h2><p role="alert">{error}</p><p>The link may be invalid or expired. Sign in and request a new verification link.</p><Link href="/login" className="faa-submit">Back to sign in <ArrowRight aria-hidden /></Link></div>}
  </AdminAuthShell>;
}
