"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Edit2,
  Trash2,
  Shield,
  User,
  Lock,
  Mail,
  CheckCircle,
  Eye,
  MapPin,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { UserModal } from "../components/user-modal"
import { UserDetailsModal } from "../components/user-details-modal"
import { UserAddressesModal } from "../components/user-addresses-modal"
import { UserPaymentMethodsModal } from "../components/user-payment-methods-modal"

const mockUsers = [
  {
    id: "507f1f77bcf86cd799439011",
    name: "John Doe",
    email: "john@example.com",
    role: "user",
    avatar: "https://images.unsplash.com/photo-1535713575915-37453b76f588?w=400",
    phone: "+1-555-0101",
    address: "123 Main Street, San Francisco, CA 94102",
    is_email_verified: true,
    two_factor_enabled: false,
    active: true,
    stripe_customer_id: "cus_123456789",
    payment_methods: [{ type: "card", last4: "4242", brand: "visa" }],
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-15T14:30:00Z",
  },
  {
    id: "507f1f77bcf86cd799439012",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "admin",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
    phone: "+1-555-0102",
    address: "456 Oak Avenue, New York, NY 10001",
    is_email_verified: true,
    two_factor_enabled: true,
    active: true,
    stripe_customer_id: "cus_987654321",
    payment_methods: [{ type: "card", last4: "5555", brand: "mastercard" }],
    created_at: "2023-12-15T08:20:00Z",
    updated_at: "2024-01-14T09:15:00Z",
  },
  {
    id: "507f1f77bcf86cd799439013",
    name: "Bob Johnson",
    email: "bob@example.com",
    role: "user",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
    phone: "+1-555-0103",
    address: "789 Pine Road, Austin, TX 78701",
    is_email_verified: false,
    two_factor_enabled: false,
    active: true,
    stripe_customer_id: null,
    payment_methods: [],
    created_at: "2024-01-05T12:45:00Z",
    updated_at: "2024-01-16T11:20:00Z",
  },
  {
    id: "507f1f77bcf86cd799439014",
    name: "Alice Brown",
    email: "alice@example.com",
    role: "publisher",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
    phone: "+1-555-0104",
    address: "321 Elm Street, Seattle, WA 98101",
    is_email_verified: true,
    two_factor_enabled: true,
    active: false,
    stripe_customer_id: "cus_555666777",
    payment_methods: [{ type: "card", last4: "1111", brand: "amex" }],
    created_at: "2023-11-20T15:30:00Z",
    updated_at: "2024-01-10T16:45:00Z",
  },
]

const newUsersData = [
  { date: "Jan 1", users: 10 },
  { date: "Jan 2", users: 15 },
  { date: "Jan 3", users: 12 },
  { date: "Jan 4", users: 18 },
  { date: "Jan 5", users: 22 },
  { date: "Jan 6", users: 25 },
  { date: "Jan 7", users: 28 },
]

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [activeFilter, setActiveFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const [sortOrder, setSortOrder] = useState("desc")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isAddressesOpen, setIsAddressesOpen] = useState(false)
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [users, setUsers] = useState(mockUsers)

  const filteredAndSortedUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.phone && user.phone.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesActive = activeFilter === "all" || (activeFilter === "active" ? user.active : !user.active)
      return matchesSearch && matchesRole && matchesActive
    })

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const aVal: any = a[sortBy as keyof typeof a]
      const bVal: any = b[sortBy as keyof typeof b]

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1
      return 0
    })

    return sorted
  }, [users, searchTerm, roleFilter, activeFilter, sortBy, sortOrder])

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * limit
    return filteredAndSortedUsers.slice(start, start + limit)
  }, [filteredAndSortedUsers, page, limit])

  const totalPages = Math.ceil(filteredAndSortedUsers.length / limit)

  const handleUserSubmit = (userData: any) => {
    if (editingUser) {
      setUsers(
        users.map((u) => (u.id === editingUser.id ? { ...u, ...userData, updated_at: new Date().toISOString() } : u)),
      )
      setEditingUser(null)
    } else {
      const newUser = {
        id: `507f1f77bcf86cd799439${String(users.length + 1).padStart(3, "0")}`,
        ...userData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setUsers([...users, newUser])
    }
    setIsUserModalOpen(false)
  }

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter((u) => u.id !== userId))
    }
  }

  const handleViewUser = (user: any) => {
    setSelectedUser(user)
    setIsDetailsModalOpen(true)
  }

  const handleEditUser = (user: any) => {
    setEditingUser(user)
    setIsUserModalOpen(true)
  }

  const handleViewAddresses = (user: any) => {
    setSelectedUser(user)
    setIsAddressesOpen(true)
  }

  const handleViewPaymentMethods = (user: any) => {
    setSelectedUser(user)
    setIsPaymentMethodsOpen(true)
  }

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Users</h1>
          <p className="text-[#A0A0A8] mt-1">Manage user accounts and permissions</p>
        </div>
        <Button
          onClick={() => {
            setEditingUser(null)
            setIsUserModalOpen(true)
          }}
          className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] hover:shadow-lg hover:shadow-purple-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setPage(1)
          }}
          className="bg-[#1F1F28] border-[#2A2A35] text-white placeholder:text-[#A0A0A8]"
        />

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
        >
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="publisher">Publisher</option>
          <option value="admin">Admin</option>
        </select>

        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Users Table */}
      <Card className="glass-dark p-6 border-[#2A2A35] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A35]">
              <th
                className="text-left py-3 px-4 text-[#A0A0A8] font-medium cursor-pointer hover:text-white"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center gap-2">
                  User
                  {sortBy === "name" && <ArrowUpDown className="w-4 h-4" />}
                </div>
              </th>
              <th
                className="text-left py-3 px-4 text-[#A0A0A8] font-medium cursor-pointer hover:text-white"
                onClick={() => toggleSort("email")}
              >
                <div className="flex items-center gap-2">
                  Email
                  {sortBy === "email" && <ArrowUpDown className="w-4 h-4" />}
                </div>
              </th>
              <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Role</th>
              <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Email Verified</th>
              <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">2FA</th>
              <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Status</th>
              <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Related Data</th>
              <th className="text-left py-3 px-4 text-[#A0A0A8] font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => (
              <tr key={user.id} className="border-b border-[#2A2A35] hover:bg-[#1F1F28] transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatar || "/placeholder.svg?height=32&width=32"}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <span className="text-white font-medium">{user.name}</span>
                      <p className="text-xs text-[#A0A0A8]">{user.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-[#A0A0A8]">{user.email}</td>
                <td className="py-3 px-4">
                  <span className="flex items-center gap-1 text-white">
                    {user.role === "admin" ? (
                      <>
                        <Shield className="w-4 h-4 text-purple-400" />
                        Admin
                      </>
                    ) : user.role === "publisher" ? (
                      <>
                        <User className="w-4 h-4 text-blue-400" />
                        Publisher
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 text-gray-400" />
                        User
                      </>
                    )}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {user.is_email_verified ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Mail className="w-4 h-4" />
                      Pending
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {user.two_factor_enabled ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Lock className="w-4 h-4" />
                      Enabled
                    </span>
                  ) : (
                    <span className="text-[#A0A0A8]">Disabled</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {user.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewAddresses(user)}
                      title="View Addresses"
                      className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                    >
                      <MapPin className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleViewPaymentMethods(user)}
                      title="View Payment Methods"
                      className="p-1 hover:bg-green-500/20 rounded transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-green-400" />
                    </button>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewUser(user)}
                      className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                    >
                      <Eye className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleEditUser(user)}
                      className="p-1 hover:bg-[#2A2A35] rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-[#A0A0A8]" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-[#A0A0A8]">
            Showing {paginatedUsers.length === 0 ? 0 : (page - 1) * limit + 1} to{" "}
            {Math.min(page * limit, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length} users
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} variant="outline" size="sm">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, page - 2) + i
              if (pageNum > totalPages) return null
              return (
                <Button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  variant={page === pageNum ? "default" : "outline"}
                  size="sm"
                >
                  {pageNum}
                </Button>
              )
            })}
            <Button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              variant="outline"
              size="sm"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* New Users Chart */}
      <Card className="glass-dark p-6 border-[#2A2A35]">
        <h3 className="text-white font-semibold mb-4">New Users per Day</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={newUsersData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" />
            <XAxis dataKey="date" stroke="#A0A0A8" />
            <YAxis stroke="#A0A0A8" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F1F28",
                border: "1px solid #2A2A35",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#F5F5F7" }}
            />
            <Line type="monotone" dataKey="users" stroke="#7C3AED" strokeWidth={2} dot={{ fill: "#7C3AED" }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Total Users</p>
          <p className="text-2xl font-bold text-white mt-2">{filteredAndSortedUsers.length}</p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Active Users</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {filteredAndSortedUsers.filter((u) => u.active).length}
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">Email Verified</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">
            {filteredAndSortedUsers.filter((u) => u.is_email_verified).length}
          </p>
        </Card>
        <Card className="glass-dark p-6 border-[#2A2A35]">
          <p className="text-[#A0A0A8] text-sm font-medium">2FA Enabled</p>
          <p className="text-2xl font-bold text-purple-400 mt-2">
            {filteredAndSortedUsers.filter((u) => u.two_factor_enabled).length}
          </p>
        </Card>
      </div>

      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false)
          setEditingUser(null)
        }}
        onSubmit={handleUserSubmit}
        initialData={editingUser}
      />
      <UserDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} user={selectedUser} />
      <UserAddressesModal isOpen={isAddressesOpen} onClose={() => setIsAddressesOpen(false)} user={selectedUser} />
      <UserPaymentMethodsModal
        isOpen={isPaymentMethodsOpen}
        onClose={() => setIsPaymentMethodsOpen(false)}
        user={selectedUser}
      />
    </div>
  )
}
