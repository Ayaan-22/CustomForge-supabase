"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BarChart3,
  Package,
  ShoppingCart,
  Users,
  Ticket,
  FileText,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics/sales", label: "Sales Analytics", icon: BarChart3 },
  { href: "/admin/analytics/inventory", label: "Inventory", icon: Package },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/logs", label: "Logs", icon: FileText },
]

export function Sidebar({ open, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "relative h-screen bg-gradient-to-b from-[#14141A] to-[#0B0B0F] border-r border-[#2A2A35] transition-all duration-300 z-40",
          open ? "w-64" : "w-20",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[#2A2A35]">
          {open && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] flex items-center justify-center">
                <span className="text-white font-bold text-sm">CF</span>
              </div>
              <span className="font-bold text-white text-lg">CustomForge</span>
            </div>
          )}
          <button onClick={onToggle} className="p-1 hover:bg-[#2A2A35] rounded-lg transition-colors">
            {open ? (
              <ChevronLeft className="w-5 h-5 text-[#A0A0A8]" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[#A0A0A8]" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] text-white shadow-lg shadow-purple-500/20"
                    : "text-[#A0A0A8] hover:bg-[#2A2A35] hover:text-white",
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {open && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
