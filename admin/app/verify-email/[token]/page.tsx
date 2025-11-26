"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { authClient } from "../../../lib/auth-client"

export default function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const verify = async () => {
      try {
        await authClient.verifyEmail(token)
        setSuccess(true)
      } catch (err: any) {
        setError(err.message || "Failed to verify email")
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      verify()
    }
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#18181b] border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center">
        {loading ? (
          <div className="py-8">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-medium text-white">Verifying your email...</h2>
            <p className="text-gray-400 mt-2">Please wait while we confirm your email address.</p>
          </div>
        ) : success ? (
          <div className="py-8">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
            <p className="text-gray-400 mb-8">
              Your email has been successfully verified. You can now access all features of CustomForge.
            </p>
            <Link
              href="/login"
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3 rounded-lg transition-colors"
            >
              Continue to Login
            </Link>
          </div>
        ) : (
          <div className="py-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
            <p className="text-gray-400 mb-2">{error}</p>
            <p className="text-gray-500 text-sm mb-8">
              The link might be invalid or expired. Please request a new verification link.
            </p>
            <Link
              href="/login"
              className="inline-block bg-[#27272a] hover:bg-[#3f3f46] text-white font-medium px-8 py-3 rounded-lg border border-white/10 transition-colors"
            >
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
