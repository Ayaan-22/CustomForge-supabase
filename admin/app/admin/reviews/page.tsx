"use client"

import { useState, useMemo } from "react"
import { Search, Star, Eye, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApiClient } from "../components/api-provider"
import { ReviewDetailsModal } from "./components/review-details-modal"

interface Review {
  id: string
  product_id: string
  user_id: string
  rating: number
  title: string
  comment: string
  verified_purchase: boolean
  helpful_votes: number
  reported: boolean
  report_reason?: string
  media: string[]
  platform?: string
  playtime_hours?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const mockReviews: Review[] = [
  {
    id: "rev001",
    product_id: "507f1f77bcf86cd799439011",
    user_id: "507f1f77bcf86cd799439011",
    rating: 5,
    title: "Incredible Performance",
    comment: "This GPU is absolutely amazing! Runs all games at ultra settings with 4K resolution.",
    verified_purchase: true,
    helpful_votes: 245,
    reported: false,
    media: ["https://example.com/gpu-review-1.jpg"],
    platform: "NVIDIA CUDA",
    playtime_hours: null,
    is_active: true,
    created_at: "2024-10-15T10:30:00Z",
    updated_at: "2024-10-15T10:30:00Z",
  },
  {
    id: "rev002",
    product_id: "507f1f77bcf86cd799439012",
    user_id: "507f1f77bcf86cd799439012",
    rating: 4,
    title: "Great CPU, Runs Hot",
    comment: "Excellent performance but runs quite hot. Make sure you have good cooling.",
    verified_purchase: true,
    helpful_votes: 156,
    reported: false,
    media: [],
    platform: null,
    playtime_hours: null,
    is_active: true,
    created_at: "2024-10-14T14:20:00Z",
    updated_at: "2024-10-14T14:20:00Z",
  },
  {
    id: "rev003",
    product_id: "507f1f77bcf86cd799439013",
    user_id: "507f1f77bcf86cd799439013",
    rating: 3,
    title: "Good but Expensive",
    comment: "Display quality is excellent with vibrant colors. Price is a bit steep though.",
    verified_purchase: false,
    helpful_votes: 89,
    reported: false,
    media: [],
    platform: null,
    playtime_hours: null,
    is_active: true,
    created_at: "2024-10-13T09:15:00Z",
    updated_at: "2024-10-13T09:15:00Z",
  },
  {
    id: "rev004",
    product_id: "507f1f77bcf86cd799439014",
    user_id: "507f1f77bcf86cd799439014",
    rating: 2,
    title: "Compatibility Issues",
    comment: "Had issues getting this RAM to work with my motherboard.",
    verified_purchase: true,
    helpful_votes: 45,
    reported: true,
    report_reason: "Potentially misleading",
    media: [],
    platform: null,
    playtime_hours: null,
    is_active: true,
    created_at: "2024-10-12T16:45:00Z",
    updated_at: "2024-10-12T16:45:00Z",
  },
  {
    id: "rev005",
    product_id: "507f1f77bcf86cd799439015",
    user_id: "507f1f77bcf86cd799439011",
    rating: 5,
    title: "Lightning Fast Storage",
    comment: "Incredibly fast read/write speeds. Perfect for video editing.",
    verified_purchase: true,
    helpful_votes: 312,
    reported: false,
    media: [],
    platform: null,
    playtime_hours: null,
    is_active: true,
    created_at: "2024-10-11T11:20:00Z",
    updated_at: "2024-10-11T11:20:00Z",
  },
]

export default function ReviewsPage() {
  const apiClient = useApiClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [ratingFilter, setRatingFilter] = useState<string>("all")
  const [reportedFilter, setReportedFilter] = useState<string>("all")
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [localReviews, setLocalReviews] = useState<Review[]>(mockReviews)

  const filteredReviews = useMemo(() => {
    if (!localReviews || !Array.isArray(localReviews)) return []

    return localReviews.filter((review) => {
      const matchesSearch =
        review.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.comment.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesRating = ratingFilter === "all" || review.rating === Number.parseInt(ratingFilter)
      const matchesReported =
        reportedFilter === "all" ||
        (reportedFilter === "not-reported" && !review.reported) ||
        (reportedFilter === "reported" && review.reported)

      const matchesActive = review.is_active

      return matchesSearch && matchesRating && matchesReported && matchesActive
    })
  }, [localReviews, searchTerm, ratingFilter, reportedFilter])

  const stats = {
    total: localReviews?.length || 0,
    verified: localReviews?.filter((r) => r.verified_purchase).length || 0,
    reported: localReviews?.filter((r) => r.reported).length || 0,
    withMedia: localReviews?.filter((r) => r.media && r.media.length > 0).length || 0,
    averageRating:
      localReviews && localReviews.length > 0
        ? (localReviews.reduce((sum, r) => sum + r.rating, 0) / localReviews.length).toFixed(1)
        : 0,
  }

  const handleViewDetails = (review: Review) => {
    setSelectedReview(review)
    setShowDetailsModal(true)
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (confirm("Are you sure you want to delete this review?")) {
      try {
        await apiClient.deleteProductReview(reviewId)
        setLocalReviews(localReviews.filter((r) => r.id !== reviewId))
      } catch (err) {
        console.error("Failed to delete review:", err)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Reviews Management</h1>
        <p className="text-[#A0A0A8]">Manage and moderate product reviews</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-[#1A1A24] to-[#0F0F14] border border-[#2A2A35] rounded-lg p-4">
          <p className="text-[#A0A0A8] text-sm mb-2">Total Reviews</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1A1A24] to-[#0F0F14] border border-[#2A2A35] rounded-lg p-4">
          <p className="text-[#A0A0A8] text-sm mb-2">Verified</p>
          <p className="text-2xl font-bold text-green-400">{stats.verified}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1A1A24] to-[#0F0F14] border border-[#2A2A35] rounded-lg p-4">
          <p className="text-[#A0A0A8] text-sm mb-2">Reported</p>
          <p className="text-2xl font-bold text-red-400">{stats.reported}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1A1A24] to-[#0F0F14] border border-[#2A2A35] rounded-lg p-4">
          <p className="text-[#A0A0A8] text-sm mb-2">With Media</p>
          <p className="text-2xl font-bold text-blue-400">{stats.withMedia}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1A1A24] to-[#0F0F14] border border-[#2A2A35] rounded-lg p-4">
          <p className="text-[#A0A0A8] text-sm mb-2">Avg Rating</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-white">{stats.averageRating}</p>
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-br from-[#1A1A24] to-[#0F0F14] border border-[#2A2A35] rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-[#A0A0A8]" />
            <Input
              placeholder="Search by product, title, or comment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#0F0F14] border-[#2A2A35] text-white placeholder-[#A0A0A8]"
            />
          </div>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="bg-[#0F0F14] border-[#2A2A35] text-white">
              <SelectValue placeholder="Filter by rating" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A24] border-[#2A2A35]">
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4 Stars</SelectItem>
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="2">2 Stars</SelectItem>
              <SelectItem value="1">1 Star</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reportedFilter} onValueChange={setReportedFilter}>
            <SelectTrigger className="bg-[#0F0F14] border-[#2A2A35] text-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A24] border-[#2A2A35]">
              <SelectItem value="all">All Reviews</SelectItem>
              <SelectItem value="not-reported">Not Reported</SelectItem>
              <SelectItem value="reported">Reported</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-gradient-to-br from-[#1A1A24] to-[#0F0F14] border border-[#2A2A35] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2A35]">
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A8]">Product ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A8]">Rating</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A8]">Title</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A8]">Verified</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A8]">Helpful</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A8]">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A8]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map((review) => (
                <tr key={review.id} className="border-b border-[#2A2A35] hover:bg-[#1A1A24]/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-white font-mono">{review.product_id.slice(0, 8)}...</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-[#2A2A35]"
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white truncate max-w-xs">{review.title}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        review.verified_purchase ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {review.verified_purchase ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white">{review.helpful_votes}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        review.reported ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                      }`}
                    >
                      {review.reported ? "Reported" : "Active"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewDetails(review)}
                        className="text-blue-400 hover:bg-blue-500/10"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteReview(review.id)}
                        className="text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReviews.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#A0A0A8]">No reviews found</p>
          </div>
        )}
      </div>

      {/* Review Details Modal */}
      {selectedReview && (
        <ReviewDetailsModal review={selectedReview} open={showDetailsModal} onOpenChange={setShowDetailsModal} />
      )}
    </div>
  )
}
