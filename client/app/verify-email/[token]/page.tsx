"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AuthService } from "@/services/auth-service"

export default function VerifyEmailPage() {
  const params = useParams()
  const router = useRouter()
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const token = params.token as string
    AuthService.verifyEmail(token).then((res) => {
      if (res.error) {
        setStatus("error")
        setMessage(res.error.message)
      } else {
        setStatus("success")
        setMessage(res.data?.message || "Email verified successfully")
      }
    })
  }, [params.token])

  return (
    <div className="container mx-auto grid place-items-center px-4 py-12">
      <div className="w-full max-w-md space-y-4 rounded-md border bg-card/60 p-6 text-center">
        {status === "verifying" && (
          <>
            <h1 className="font-heading text-2xl">Verifying email...</h1>
            <p className="text-sm text-muted-foreground">Please wait</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="font-heading text-2xl text-green-600">Email verified!</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button onClick={() => router.push("/login")} className="w-full">
              Sign in
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="font-heading text-2xl text-destructive">Verification failed</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button variant="outline" onClick={() => router.push("/")} className="w-full">
              Go home
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
