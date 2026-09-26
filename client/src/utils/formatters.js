/**
 * Formatting utilities for RicozIngest Dashboard
 */

/**
 * Format numbers with thousands separators (e.g. 1,420,500)
 * @param {number|string} value
 * @returns {string}
 */
export function formatNumber(value) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '0';
  }
  return Number(value).toLocaleString('en-US');
}

/**
 * Format ISO date string into readable date and time
 * @param {string|Date} dateString
 * @returns {string}
 */
export function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return '—';
  }
}

/**
 * Format relative elapsed time from timestamp (e.g., "5m ago", "Just now")
 * @param {string|Date} dateString
 * @returns {string}
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return 'Never';
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 0) {
      // Future date
      const futureSec = Math.abs(diffSec);
      if (futureSec < 60) return `in ${futureSec}s`;
      if (futureSec < 3600) return `in ${Math.floor(futureSec / 60)}m`;
      if (futureSec < 86400) return `in ${Math.floor(futureSec / 3600)}h`;
      return `in ${Math.floor(futureSec / 86400)}d`;
    }

    if (diffSec < 30) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return '—';
  }
}

/**
 * Format execution runtime duration between start and end timestamps
 * @param {string|Date} startedAt
 * @param {string|Date} completedAt
 * @returns {string}
 */
export function formatDuration(startedAt, completedAt) {
  if (!startedAt) return '—';
  try {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);

    if (diffMs < 1000) return `${diffMs}ms`;
    const sec = (diffMs / 1000).toFixed(1);
    if (diffMs < 60000) return `${sec}s`;
    const min = Math.floor(diffMs / 60000);
    const remSec = Math.floor((diffMs % 60000) / 1000);
    return `${min}m ${remSec}s`;
  } catch {
    return '—';
  }
}
