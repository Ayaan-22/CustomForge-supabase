"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface User {
  id: string
  name: string
  email: string
  password?: string
  role: "user" | "publisher" | "admin"
  avatar: string
  isEmailVerified: boolean
  twoFactorEnabled: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (user: Partial<User>) => void
  initialData?: User
}

export function UserModal({ isOpen, onClose, onSubmit, initialData }: UserModalProps) {
  const [formData, setFormData] = useState<Partial<User>>({
    name: "",
    email: "",
    password: "",
    role: "user",
    avatar: "default.jpg",
    isEmailVerified: false,
    twoFactorEnabled: false,
    active: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const isEditing = !!initialData

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        email: initialData.email,
        role: initialData.role,
        avatar: initialData.avatar,
        isEmailVerified: initialData.isEmailVerified,
        twoFactorEnabled: initialData.twoFactorEnabled,
        active: initialData.active,
      })
    } else {
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "user",
        avatar: "default.jpg",
        isEmailVerified: false,
        twoFactorEnabled: false,
        active: true,
      })
    }
    setErrors({})
  }, [initialData, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = "Name is required"
    } else if (formData.name.length > 50) {
      newErrors.name = "Name cannot exceed 50 characters"
    }

    if (!formData.email || formData.email.trim().length === 0) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format"
    }

    if (!isEditing) {
      if (!formData.password || formData.password.length === 0) {
        newErrors.password = "Password is required"
      } else if (formData.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1F1F28] border-[#2A2A35] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{isEditing ? "Edit User" : "Add New User"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <Input
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter user name"
              className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <Input
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter email address"
              className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Password - Only for new users */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-[#A0A0A8] mb-2">
                Password <span className="text-red-400">*</span>
              </label>
              <Input
                type="password"
                value={formData.password || ""}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password (min 8 characters)"
                className="bg-[#2A2A35] border-[#3A3A45] text-white placeholder:text-[#6A6A78]"
              />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A8] mb-2">Role</label>
            <select
              value={formData.role || "user"}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full px-3 py-2 bg-[#2A2A35] border border-[#3A3A45] text-white rounded-lg"
            >
              <option value="user">User</option>
              <option value="publisher">Publisher</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Email Verified */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="emailVerified"
              checked={formData.isEmailVerified || false}
              onChange={(e) => setFormData({ ...formData, isEmailVerified: e.target.checked })}
              className="w-4 h-4 rounded bg-[#2A2A35] border-[#3A3A45]"
            />
            <label htmlFor="emailVerified" className="text-sm text-[#A0A0A8]">
              Email Verified
            </label>
          </div>

          {/* 2FA Enabled */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="twoFactor"
              checked={formData.twoFactorEnabled || false}
              onChange={(e) => setFormData({ ...formData, twoFactorEnabled: e.target.checked })}
              className="w-4 h-4 rounded bg-[#2A2A35] border-[#3A3A45]"
            />
            <label htmlFor="twoFactor" className="text-sm text-[#A0A0A8]">
              Two-Factor Authentication Enabled
            </label>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="active"
              checked={formData.active ?? true}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 rounded bg-[#2A2A35] border-[#3A3A45]"
            />
            <label htmlFor="active" className="text-sm text-[#A0A0A8]">
              Active Account
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} className="flex-1 bg-[#2A2A35] hover:bg-[#3A3A45] text-white">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] hover:shadow-lg hover:shadow-purple-500/20"
            >
              {isEditing ? "Update User" : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
