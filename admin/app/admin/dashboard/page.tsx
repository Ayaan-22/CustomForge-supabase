"use client"

import { DashboardOverview } from "../components/dashboard-overview"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-[#A0A0A8] mt-1">Welcome back to CustomForge Admin</p>
      </div>

      <DashboardOverview />
    </div>
  )
}
