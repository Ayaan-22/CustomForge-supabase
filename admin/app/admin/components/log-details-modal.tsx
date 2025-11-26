"use client"

import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertCircle, AlertTriangle, Info } from "lucide-react"

interface LogDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  log: any
}

const levelIcons: Record<string, React.ReactNode> = {
  info: <Info className="w-5 h-5 text-blue-400" />,
  warn: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
  error: <AlertCircle className="w-5 h-5 text-red-400" />,
}

const levelColors: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-400",
  warn: "bg-yellow-500/20 text-yellow-400",
  error: "bg-red-500/20 text-red-400",
}

export function LogDetailsModal({ isOpen, onClose, log }: LogDetailsModalProps) {
  if (!log) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1F1F28] border-[#2A2A35] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Log Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Level Badge */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#A0A0A8] uppercase tracking-wide">Log Level</h3>
            <div
              className={`px-3 py-2 rounded-full text-sm font-medium flex items-center gap-2 w-fit ${levelColors[log.level]}`}
            >
              {levelIcons[log.level]}
              {log.level.toUpperCase()}
            </div>
          </div>

          {/* Action & Admin */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#A0A0A8] uppercase tracking-wide">Action Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-1">Action</p>
                <p className="text-white font-medium">{log.action}</p>
              </div>
              <div className="bg-[#2A2A35] rounded-lg p-4">
                <p className="text-xs text-[#A0A0A8] mb-1">Performed By</p>
                <p className="text-white font-medium">{log.admin}</p>
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#A0A0A8] uppercase tracking-wide">Timestamp</h3>
            <div className="bg-[#2A2A35] rounded-lg p-4">
              <p className="text-white font-mono text-sm">{log.date}</p>
            </div>
          </div>

          {/* Detailed Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#A0A0A8] uppercase tracking-wide">Detailed Information</h3>
            <div className="bg-[#0F0F15] border border-[#2A2A35] rounded-lg p-4">
              <pre className="text-[#A0A0A8] text-xs overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
