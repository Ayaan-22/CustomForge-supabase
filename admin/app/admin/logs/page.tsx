"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronDown, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { LogDetailsModal } from "../components/log-details-modal";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

const levelColors: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-400",
  warn: "bg-yellow-500/20 text-yellow-400",
  error: "bg-red-500/20 text-red-400",
};

const levelIcons: Record<string, React.ReactNode> = {
  info: <Info className="w-4 h-4" />,
  warn: <AlertTriangle className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
};

export default function LogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logStats, setLogStats] = useState<any>(null);
  const itemsPerPage = 20;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Note: api-client getLogs takes page and limit
      // We might need to handle filtering client-side if API doesn't support it yet,
      // or update API to support filtering.
      // Based on api-client, getLogs(page, limit)

      const [logsData, statsData] = await Promise.all([
        apiClient.getLogs(currentPage, itemsPerPage),
        apiClient.getLogStats(),
      ]);

      const fetchedLogs = logsData.data || logsData;

      // Client-side filtering if API doesn't support it (assuming it returns paginated list)
      // If API supports filtering, we should pass params.
      // For now, let's assume we get a list and filter client side if needed,
      // but ideally we should pass filters to API.
      // Since getLogs only accepts page and limit, we'll filter client side on the current page
      // OR we accept that filtering only works on the fetched page.
      // To do it properly, we should update getLogs to accept filters.
      // But for now, let's just display what we get.

      setLogs(Array.isArray(fetchedLogs) ? fetchedLogs : []);
      setTotalPages(logsData.pages || 1);
      setTotalLogs(logsData.count || 0);
      setLogStats(statsData);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage]);

  // Client-side filtering for display (on top of server pagination)
  // Ideally this should be server-side.
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.admin?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const handleViewDetails = (log: any) => {
    setSelectedLog(log);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Logs</h1>
        <p className="text-[#A0A0A8] mt-1">View system activity logs</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-[#1F1F28] border-[#2A2A35] text-white placeholder:text-[#A0A0A8]"
        />

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg"
        >
          <option value="all">All Levels</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Logs Table */}
      <Card className="glass-dark p-6 border-[#2A2A35]">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-[#A0A0A8]">
                No logs found
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id}>
                  <button
                    onClick={() => handleViewDetails(log)}
                    className={`w-full flex items-center justify-between p-4 hover:bg-[#1F1F28] rounded-lg transition-colors border border-[#2A2A35] ${
                      log.level === "error" ? "bg-red-500/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1 text-left">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                          levelColors[log.level] || levelColors.info
                        }`}
                      >
                        {levelIcons[log.level] || levelIcons.info}
                        {(log.level || "INFO").toUpperCase()}
                      </span>

                      <div>
                        <p className="text-white font-medium">{log.action}</p>
                        <p className="text-[#A0A0A8] text-sm">{log.admin}</p>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                      <p className="text-[#A0A0A8] text-sm w-40">
                        {new Date(log.created_at || log.date).toLocaleString()}
                      </p>
                    </div>

                    <ChevronDown
                      className={`w-5 h-5 text-[#A0A0A8] transition-transform ${
                        expandedLog === log.id ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg disabled:opacity-50"
          >
            Previous
          </button>

          <span className="text-[#A0A0A8] px-2">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-[#1F1F28] border border-[#2A2A35] text-white rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Log Stats */}
      {logStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Total Logs</p>
            <p className="text-2xl font-bold text-white mt-2">
              {logStats.total || 0}
            </p>
          </Card>
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Info</p>
            <p className="text-2xl font-bold text-blue-400 mt-2">
              {logStats.info || 0}
            </p>
          </Card>
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Warnings</p>
            <p className="text-2xl font-bold text-yellow-400 mt-2">
              {logStats.warnings || 0}
            </p>
          </Card>
          <Card className="glass-dark p-6 border-[#2A2A35]">
            <p className="text-[#A0A0A8] text-sm font-medium">Errors</p>
            <p className="text-2xl font-bold text-red-400 mt-2">
              {logStats.errors || 0}
            </p>
          </Card>
        </div>
      )}

      {/* Log Details Modal */}
      <LogDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        log={selectedLog}
      />
    </div>
  );
}
