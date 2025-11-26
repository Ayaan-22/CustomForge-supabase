"use client"

import Link from "next/link"
import { Menu, Search, Bell, Settings, LogOut, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/app/components/auth-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()

  return (
    <header className="h-16 border-b border-[#2A2A35] bg-[#14141A]/80 backdrop-blur-md flex items-center justify-between px-6 md:px-8">
      {/* Left: Menu & Search */}
      <div className="flex items-center gap-4 flex-1">
        <button onClick={onMenuClick} className="md:hidden p-2 hover:bg-[#2A2A35] rounded-lg transition-colors">
          <Menu className="w-5 h-5 text-[#A0A0A8]" />
        </button>

        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#A0A0A8]" />
          <Input
            placeholder="Search..."
            className="bg-[#1F1F28] border-[#2A2A35] text-white placeholder:text-[#A0A0A8]"
          />
        </div>
      </div>

      {/* Right: Notifications & Profile */}
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-[#2A2A35] rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-[#A0A0A8]" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#3B82F6] rounded-full" />
        </button>

        <Link href="/admin/profile">
          <button className="p-2 hover:bg-[#2A2A35] rounded-lg transition-colors">
            <Settings className="w-5 h-5 text-[#A0A0A8]" />
          </button>
        </Link>

        {/* Admin Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 pl-4 border-l border-[#2A2A35] hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.charAt(0) || "A"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white">{user?.name || "Admin"}</p>
                <p className="text-xs text-[#A0A0A8] capitalize">{user?.role || "Administrator"}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#1F1F28] border-[#2A2A35] text-white">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#2A2A35]" />
            <DropdownMenuItem asChild className="focus:bg-[#2A2A35] focus:text-white cursor-pointer">
              <Link href="/admin/profile" className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="focus:bg-[#2A2A35] focus:text-white cursor-pointer">
              <Link href="/admin/profile" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2A2A35]" />
            <DropdownMenuItem
              onClick={logout}
              className="focus:bg-red-500/10 focus:text-red-500 text-red-500 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
