"use client";
import "../forge-operations.css";
import {useUrlState} from "@/hooks/use-url-state";

import { useAdminQuery } from "@/hooks/use-admin-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { QueryError } from "@/components/patterns/query-error";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/patterns/section-header";
import { PageShell } from "@/components/patterns/page-shell";
import { ActionBar } from "@/components/patterns/action-bar";
import { Pagination } from "@/components/patterns/pagination";
import { EmptyState } from "@/components/patterns/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, AlertCircle, Info, AlertTriangle, Search, Activity, RefreshCw } from "lucide-react";
import { LogDetailsModal } from "../components/log-details-modal";
import { apiClient } from "@/lib/api-client";
import type { LogEntry } from "@/types/logs";

type LogView = LogEntry & { id: string; action: string; admin: string; date?: string; details: LogEntry };


const levelColors: Record<string, string> = {
  info: "is-neutral",
  warn: "is-warning",
  error: "is-danger",
};

const levelIcons: Record<string, React.ReactNode> = {
  info: <Info className="w-4 h-4" />,
  warn: <AlertTriangle className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
};

export default function LogsPage() {
  const [searchTerm, setSearchTerm] = useUrlState("searchTerm", "");
  const [levelFilter, setLevelFilter] = useUrlState("levelFilter", "all");
  const [selectedLog, setSelectedLog] = useState<LogView | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useUrlState("page", 1);
  const itemsPerPage = 20;
  const search = useDebouncedValue(searchTerm);
  const query = useAdminQuery(['logs', currentPage, search, levelFilter], () => apiClient.getLogs(currentPage, itemsPerPage, search, levelFilter));
  const stats = useAdminQuery(['log-stats'], () => apiClient.getLogStats());
  // Request and response events can share a requestId; each row still needs a unique key.
  const filteredLogs: LogView[] = (query.data?.data ?? []).map((entry, index) => ({...entry, id: `${entry.requestId ?? 'event'}:${index}`, action: entry.message ?? 'System event', admin: entry.adminId ?? entry.userId ?? 'System', date: entry.timestamp, details: entry}));
  const totalPages = query.data?.pagination?.pages ?? 1;
  const totalLogs = query.data?.pagination?.total ?? 0;
  const logStats = stats.data;
  const loading = query.isLoading;
  const refreshing = query.isFetching || stats.isFetching;
  const hasFilters = search.length > 0 || levelFilter !== "all";
  const logDay = query.data?.filters.date;
  const timezone = query.data?.timezone;
  const refresh = () => { void query.refetch(); void stats.refetch(); };


  const handleViewDetails = (log: LogView) => {
    setSelectedLog(log);
    setIsDetailsOpen(true);
  };

  return (
    <PageShell className="fo-page">
      <SectionHeader eyebrow="System observability" title="System activity" description="Trace system events, investigate issues and inspect the full context of every log." icon={<Activity />} actions={<Button variant="outline" onClick={refresh} disabled={refreshing}><RefreshCw className="h-4 w-4" aria-hidden="true" />{refreshing ? "Refreshing…" : "Refresh"}</Button>} />
      <QueryError error={query.error || stats.error} retry={refresh} />
      {logStats && <div className="fo-stats" aria-label="System log statistics">
        {[{label: "All events", value: logStats.total || 0, icon: Activity}, {label: "Information", value: logStats.byLevel?.info || 0, icon: Info}, {label: "Warnings", value: logStats.byLevel?.warn || 0, icon: AlertTriangle}, {label: "Errors", value: logStats.errorCount || 0, icon: AlertCircle}].map(({label,value,icon:Icon}) => <div className="fo-stat" key={label}><div className="fo-stat-head"><p className="fo-stat-label">{label}</p><Icon className="fo-stat-icon" aria-hidden="true" /></div><p className="fo-stat-value">{value}</p><p className="fo-stat-note">{logStats.date} · server day</p></div>)}
      </div>}
      <ActionBar className="fo-toolbar fo-log-toolbar" layout="filters">
        <div className="fo-field"><label htmlFor="logs-search">Find an event</label><div className="fo-search"><Search aria-hidden="true" /><Input id="logs-search" placeholder="Search log messages…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
        <div className="fo-field"><label htmlFor="logs-severity">Severity</label><Select value={levelFilter} onValueChange={setLevelFilter}><SelectTrigger id="logs-severity"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All levels</SelectItem><SelectItem value="info">Information</SelectItem><SelectItem value="warn">Warning</SelectItem><SelectItem value="error">Error</SelectItem></SelectContent></Select></div>
      </ActionBar>
      <Card className="fa-panel fa-results-panel">
        <div className="fa-panel-heading"><div><h2>Event stream</h2><p>{logDay ? `${logDay}${timezone ? ` · ${timezone}` : ''}. Select an event to inspect its details.` : 'Select an event to inspect its details.'}</p></div><span className="fo-count">{totalLogs} events</span></div>
        {loading ? <div className="fo-loading" role="status" aria-label="Loading system events"><span className="fo-loading-label">Loading event stream…</span>{[0,1,2].map((row) => <div key={row} className="fo-loading-bar" />)}</div> : query.error ? null : filteredLogs.length === 0 ? <EmptyState className="m-5" icon={<Activity />} title={hasFilters ? "No matching events" : "No activity recorded yet"} description={hasFilters ? "Try another search or severity level." : `No events have been recorded for ${logDay ?? 'this server day'}. Refresh to check for new activity.`} action={hasFilters ? <Button variant="outline" onClick={() => {setSearchTerm(''); setLevelFilter('all');}}>Clear filters</Button> : undefined} /> : <div className="fo-log-list">{filteredLogs.map((log) => <button key={log.id} className={`fo-log-row ${log.level === "error" ? "is-error" : ""}`} onClick={() => handleViewDetails(log)}>
          <span className={`fa-status ${levelColors[log.level ?? 'info'] || levelColors.info}`}>{levelIcons[log.level ?? 'info'] || levelIcons.info}{(log.level || "info").toUpperCase()}</span>
          <div><p className="fo-log-message">{log.action}</p><p className="fo-log-actor">{log.admin}</p></div>
          <time className="fo-log-time">{log.created_at || log.date ? new Date(log.created_at || log.date || '').toLocaleString() : 'Time unavailable'}</time><ChevronRight className="fo-log-arrow w-4 h-4" aria-hidden="true" />
        </button>)}</div>}
        {!loading && totalLogs > 0 && <Pagination page={currentPage} pages={totalPages} pending={query.isFetching} onPage={setCurrentPage} total={totalLogs} pageSize={itemsPerPage} noun="events" />}
      </Card>
      <LogDetailsModal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} log={selectedLog} />
    </PageShell>
  );
}
