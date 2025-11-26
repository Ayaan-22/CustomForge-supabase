"use client"

import type React from "react"

import { Component } from "react"
import { AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error("[CustomForge] Error caught by boundary:", error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="glass-dark p-6 border-[#2A2A35] border-red-500/50">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-white font-semibold mb-2">Something went wrong</h3>
              <p className="text-[#A0A0A8] text-sm">{this.state.error?.message}</p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}
