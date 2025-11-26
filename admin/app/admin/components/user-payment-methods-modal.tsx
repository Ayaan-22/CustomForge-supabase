"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { CreditCard, Check } from "lucide-react"

interface PaymentMethod {
  id: string
  userId: string
  type: string
  cardHolderName: string
  cardNumber: string
  expiryMonth: number
  expiryYear: number
  billingAddress: {
    address: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  isDefault: boolean
}

interface UserPaymentMethodsModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

export function UserPaymentMethodsModal({ isOpen, onClose, user }: UserPaymentMethodsModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && user?.id) {
      loadPaymentMethods()
    }
  }, [isOpen, user?.id])

  const loadPaymentMethods = async () => {
    setLoading(true)
    try {
      const data = await fetch("/mock/user-payment-methods.json").then((res) => res.json())
      const userMethods = (data.paymentMethods || data).filter((p: PaymentMethod) => p.userId === user?.id)
      setPaymentMethods(userMethods)
    } catch (error) {
      console.error("Failed to load payment methods:", error)
      setPaymentMethods([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#1F1F28] border-[#2A2A35]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-400" />
            Payment Methods - {user?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <p className="text-[#A0A0A8]">Loading payment methods...</p>
          ) : paymentMethods.length > 0 ? (
            paymentMethods.map((method) => (
              <Card key={method.id} className="glass-dark p-4 border-[#2A2A35]">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-white font-semibold">{method.cardNumber}</h4>
                      {method.isDefault && (
                        <span className="flex items-center gap-1 bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">
                          <Check className="w-3 h-3" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[#A0A0A8] text-sm mb-2">Cardholder: {method.cardHolderName}</p>
                    <p className="text-[#A0A0A8] text-sm mb-2">
                      Type: <span className="capitalize">{method.type.replace("_", " ")}</span>
                    </p>
                    <p className="text-[#A0A0A8] text-sm mb-2">
                      Expires: {String(method.expiryMonth).padStart(2, "0")}/{method.expiryYear}
                    </p>
                    <div className="pt-2 border-t border-[#2A2A35]">
                      <p className="text-[#A0A0A8] text-xs font-semibold mb-1">Billing Address:</p>
                      <p className="text-[#A0A0A8] text-xs">{method.billingAddress.address}</p>
                      <p className="text-[#A0A0A8] text-xs">
                        {method.billingAddress.city}, {method.billingAddress.state} {method.billingAddress.postalCode}
                      </p>
                      <p className="text-[#A0A0A8] text-xs">{method.billingAddress.country}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <p className="text-[#A0A0A8]">No payment methods found for this user.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
