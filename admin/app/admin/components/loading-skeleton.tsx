"use client"

export function CardSkeleton() {
  return (
    <div className="glass-dark p-6 border-[#2A2A35] rounded-lg animate-pulse">
      <div className="h-4 bg-[#2A2A35] rounded w-1/3 mb-4" />
      <div className="h-8 bg-[#2A2A35] rounded w-1/2" />
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="glass-dark p-6 border-[#2A2A35] rounded-lg space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 bg-[#2A2A35] rounded animate-pulse" />
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="glass-dark p-6 border-[#2A2A35] rounded-lg h-80 animate-pulse">
      <div className="h-4 bg-[#2A2A35] rounded w-1/4 mb-4" />
      <div className="h-64 bg-[#2A2A35] rounded" />
    </div>
  )
}
