"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { MapPin, Check } from "lucide-react"

interface Address {
  id: string
  userId: string
  label: string
  fullName: string
  address: string
  city: string
  state: string
  postalCode: string
  country: string
  phoneNumber: string
  isDefault: boolean
}

interface UserAddressesModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

export function UserAddressesModal({ isOpen, onClose, user }: UserAddressesModalProps) {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && user?.id) {
      loadAddresses()
    }
  }, [isOpen, user?.id])

  const loadAddresses = async () => {
    setLoading(true)
    try {
      const data = await fetch("/mock/user-addresses.json").then((res) => res.json())
      const userAddresses = (data.addresses || data).filter((a: Address) => a.userId === user?.id)
      setAddresses(userAddresses)
    } catch (error) {
      console.error("Failed to load addresses:", error)
      setAddresses([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#1F1F28] border-[#2A2A35]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            Addresses - {user?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <p className="text-[#A0A0A8]">Loading addresses...</p>
          ) : addresses.length > 0 ? (
            addresses.map((address) => (
              <Card key={address.id} className="glass-dark p-4 border-[#2A2A35]">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-white font-semibold">{address.label}</h4>
                      {address.isDefault && (
                        <span className="flex items-center gap-1 bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">
                          <Check className="w-3 h-3" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[#A0A0A8] text-sm mb-1">{address.fullName}</p>
                    <p className="text-[#A0A0A8] text-sm mb-1">{address.address}</p>
                    <p className="text-[#A0A0A8] text-sm mb-1">
                      {address.city}, {address.state} {address.postalCode}
                    </p>
                    <p className="text-[#A0A0A8] text-sm mb-1">{address.country}</p>
                    <p className="text-[#A0A0A8] text-sm">{address.phoneNumber}</p>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <p className="text-[#A0A0A8]">No addresses found for this user.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
