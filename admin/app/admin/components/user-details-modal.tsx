"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Shield, Lock, Mail, CheckCircle, X } from "lucide-react"
import { format } from "date-fns"

interface UserDetails {
  id: string
  name: string
  email: string
  role: "user" | "publisher" | "admin"
  avatar: string
  phone?: string
  address?: string
  is_email_verified: boolean
  two_factor_enabled: boolean
  active: boolean
  stripe_customer_id?: string
  payment_methods?: any[]
  created_at: string
  updated_at: string
}

interface UserDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserDetails | null
}

export function UserDetailsModal({ isOpen, onClose, user }: UserDetailsModalProps) {
  if (!user) return null

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-4 h-4 text-purple-400" />
      case "publisher":
        return <X className="w-4 h-4 text-blue-400" />
      default:
        return <X className="w-4 h-4 text-gray-400" />
    }
  }

  const getRoleLabel = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1F1F28] border-[#2A2A35] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">User Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#A0A0A8] uppercase tracking-wide">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-1">Name</p>
                <p className="text-white font-medium">{user.name}</p>
              </div>
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-1">Email</p>
                <p className="text-white font-medium">{user.email}</p>
              </div>
              {user.phone && (
                <div className="bg-[#2A2A35] rounded-lg p-4">
                  <p className="text-xs text-[#A0A0A8] mb-1">Phone</p>
                  <p className="text-white font-medium">{user.phone}</p>
                </div>
              )}
              {user.address && (
                <div className="bg-[#2A2A35] rounded-lg p-4">
                  <p className="text-xs text-[#A0A0A8] mb-1">Address</p>
                  <p className="text-white font-medium text-sm">{user.address}</p>
                </div>
              )}
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-1">Role</p>
                <div className="flex items-center gap-2 text-white font-medium">
                  {getRoleIcon(user.role)}
                  {getRoleLabel(user.role)}
                </div>
              </div>
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-1">User ID</p>
                <p className="text-white font-mono text-sm">{user.id}</p>
              </div>
            </div>
          </div>

          {/* Security & Verification */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#A0A0A8] uppercase tracking-wide">Security & Verification</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-2">Email Verification</p>
                <div className="flex items-center gap-2">
                  {user.is_email_verified ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-medium">Verified</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-medium">Pending</span>
                    </>
                  )}
                </div>
              </div>
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-2">Two-Factor Authentication</p>
                <div className="flex items-center gap-2">
                  {user.two_factor_enabled ? (
                    <>
                      <Lock className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-medium">Enabled</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-gray-400" />
                      <span className="text-[#A0A0A8] font-medium">Disabled</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#A0A0A8] uppercase tracking-wide">Account Status</h3>
            <div className="bg-[#2A2A35] rounded-lg p-4">
              <p className="text-xs text-[#A0A0A8] mb-2">Status</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${user.active ? "bg-green-400" : "bg-red-400"}`} />
                <span className={`font-medium ${user.active ? "text-green-400" : "text-red-400"}`}>
                  {user.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Billing Information */}
          {user.stripe_customer_id && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#A0A0A8] uppercase tracking-wide">Billing Information</h3>
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-1">Stripe Customer ID</p>
                <p className="text-white font-mono text-sm">{user.stripe_customer_id}</p>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#A0A0A8] uppercase tracking-wide">Timestamps</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-1">Created At</p>
                <p className="text-white font-medium text-sm">
                  {user.created_at && !isNaN(new Date(user.created_at).getTime())
                    ? format(new Date(user.created_at), "MMM dd, yyyy HH:mm")
                    : "N/A"}
                </p>
              </div>
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-1">Last Updated</p>
                <p className="text-white font-medium text-sm">
                  {user.updated_at && !isNaN(new Date(user.updated_at).getTime())
                    ? format(new Date(user.updated_at), "MMM dd, yyyy HH:mm")
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
