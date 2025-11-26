"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/app/components/auth-provider"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Key, User, QrCode, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function ProfilePage() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // 2FA State
  const [isEnabling2FA, setIsEnabling2FA] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState("")
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      await authClient.updatePassword({ currentPassword, newPassword })
      toast.success("Password updated successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      toast.error(error.message || "Failed to update password")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEnable2FA = async () => {
    setIsLoading(true)
    try {
      const { qrCode } = await authClient.enableTwoFactor()
      setQrCode(qrCode)
      setIsEnabling2FA(true)
    } catch (error: any) {
      toast.error("Failed to start 2FA setup")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify2FA = async () => {
    setIsLoading(true)
    try {
      await authClient.verifyTwoFactor(verificationCode)
      toast.success("2FA enabled successfully")
      setIsEnabling2FA(false)
      setQrCode(null)
      // Ideally update user context here to reflect 2FA status
      window.location.reload() // Simple reload to refresh auth state
    } catch (error: any) {
      toast.error("Invalid verification code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    setIsLoading(true)
    try {
      await authClient.disableTwoFactor(verificationCode)
      toast.success("2FA disabled successfully")
      setShowDisableConfirm(false)
      setVerificationCode("")
      window.location.reload()
    } catch (error: any) {
      toast.error("Failed to disable 2FA")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Profile & Settings</h1>
        <p className="text-[#A0A0A8]">Manage your account settings and security preferences.</p>
      </div>

      <Tabs defaultValue="security" className="w-full">
        <TabsList className="bg-[#1F1F28] border border-[#2A2A35]">
          <TabsTrigger
            value="profile"
            className="data-[state=active]:bg-[#2A2A35] text-[#A0A0A8] data-[state=active]:text-white"
          >
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-[#2A2A35] text-[#A0A0A8] data-[state=active]:text-white"
          >
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card className="bg-[#1F1F28] border-[#2A2A35]">
            <CardHeader>
              <CardTitle className="text-white">Personal Information</CardTitle>
              <CardDescription className="text-[#A0A0A8]">Your basic account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] flex items-center justify-center text-2xl font-bold text-white">
                  {user?.name?.charAt(0) || "A"}
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-white">{user?.name}</h3>
                  <p className="text-[#A0A0A8]">{user?.email}</p>
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 mt-2">
                    {user?.role}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          {/* Two-Factor Authentication */}
          <Card className="bg-[#1F1F28] border-[#2A2A35]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Shield className="w-5 h-5 text-purple-500" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription className="text-[#A0A0A8]">
                Add an extra layer of security to your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user?.twoFactorEnabled ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-green-500">2FA is enabled</p>
                      <p className="text-sm text-[#A0A0A8]">
                        Your account is protected with two-factor authentication.
                      </p>
                    </div>
                  </div>

                  {!showDisableConfirm ? (
                    <Button variant="destructive" onClick={() => setShowDisableConfirm(true)}>
                      Disable 2FA
                    </Button>
                  ) : (
                    <div className="space-y-4 max-w-sm">
                      <div className="space-y-2">
                        <Label className="text-white">Verify to Disable</Label>
                        <Input
                          placeholder="Enter current 2FA code"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          className="bg-[#14141A] border-[#2A2A35] text-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          onClick={handleDisable2FA}
                          disabled={isLoading || !verificationCode}
                        >
                          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Confirm Disable
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setShowDisableConfirm(false)
                            setVerificationCode("")
                          }}
                          className="text-[#A0A0A8] hover:text-white"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {!isEnabling2FA ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">Protect your account</p>
                        <p className="text-sm text-[#A0A0A8] mt-1">
                          Secure your account with TOTP (Google Authenticator, Authy, etc.)
                        </p>
                      </div>
                      <Button onClick={handleEnable2FA} disabled={isLoading}>
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Enable 2FA
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="p-4 rounded-lg bg-[#14141A] border border-[#2A2A35] space-y-4">
                        <div className="flex flex-col items-center gap-4 text-center">
                          <div className="p-2 bg-white rounded-lg">
                            {/* Placeholder for QR Code - in real app, render actual QR */}
                            <QrCode className="w-32 h-32 text-black" />
                          </div>
                          <div>
                            <p className="text-white font-medium">Scan this QR Code</p>
                            <p className="text-sm text-[#A0A0A8] mt-1 max-w-xs">
                              Use your authenticator app to scan the code, then enter the generated verification code
                              below.
                            </p>
                          </div>
                        </div>

                        <div className="max-w-xs mx-auto space-y-4">
                          <div className="space-y-2">
                            <Label className="text-white">Verification Code</Label>
                            <Input
                              placeholder="000 000"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value)}
                              className="bg-[#1F1F28] border-[#2A2A35] text-white text-center tracking-widest text-lg"
                              maxLength={6}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="w-full bg-purple-600 hover:bg-purple-700"
                              onClick={handleVerify2FA}
                              disabled={isLoading || verificationCode.length < 6}
                            >
                              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Verify & Enable
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setIsEnabling2FA(false)
                                setQrCode(null)
                                setVerificationCode("")
                              }}
                              className="text-[#A0A0A8] hover:text-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="bg-[#1F1F28] border-[#2A2A35]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Key className="w-5 h-5 text-purple-500" />
                Change Password
              </CardTitle>
              <CardDescription className="text-[#A0A0A8]">Update your account password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label className="text-white">Current Password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-[#14141A] border-[#2A2A35] text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-[#14141A] border-[#2A2A35] text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-[#14141A] border-[#2A2A35] text-white"
                    required
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
