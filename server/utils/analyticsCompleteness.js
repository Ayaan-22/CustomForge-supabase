import AppError from './appError.js';

// PostgREST may cap rows without treating the query as an error. Never publish
// totals derived from that partial sample. Database aggregates remain required
// for collections above the configured cap.
export function requireCompleteAnalytics(rows, count, error) {
  if (error) return; // Preserve the controller's database-error handling.
  if (!Number.isInteger(count) || count !== (rows?.length ?? 0)) {
    throw new AppError('Analytics are unavailable for this dataset. Try a shorter date range.', 503);
  }
}
