"use client"

import type React from "react"

import { useState } from "react"
import { Sidebar } from "./components/sidebar"
import { Topbar } from "./components/topbar"
import { ApiProvider } from "./components/api-provider"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <ApiProvider>
      <div className="flex h-screen bg-gradient-to-br from-[#0B0B0F] to-[#14141A]">
        {/* Sidebar */}
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar */}
          <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-6 md:p-8">{children}</div>
          </main>
        </div>
      </div>
    </ApiProvider>
  )
}
