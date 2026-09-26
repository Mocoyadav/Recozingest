import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Workflow,
  ExternalLink
} from 'lucide-react';
import {
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatDuration
} from '../../utils/formatters.js';
import RunDiagnosticsDrawer from './RunDiagnosticsDrawer.jsx';

const LIMIT_OPTIONS = [10, 25, 50];

export function RunHistoryTable({
  runs = [],
  loading = false,
  error = null,
  pagination = { page: 1, limit: 10, total: 0, totalPages: 0 },
  onPageChange,
  onLimitChange,
  showPipelineColumn = true,
  pipelineMap = {},
  onRetry,
  onSelectRun
}) {
  const [selectedRunForDrawer, setSelectedRunForDrawer] = useState(null);

  const handleOpenDiagnostics = (run) => {
    if (onSelectRun) {
      onSelectRun(run);
    } else {
      setSelectedRunForDrawer(run);
    }
  };

  return (
    <div className="run-history-table-wrapper">
      {/* Error Alert with Retry */}
      {error && (
        <div className="auth-alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Unable to Load Run History:</strong> {error}
          </div>
          {onRetry && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onRetry}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Data Table Container */}
      <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', flexDirection: 'column', gap: '0.75rem' }}>
            <span className="spinner spinner-lg"></span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading execution runs...</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <Clock size={36} className="empty-state-icon" />
            <h4 className="empty-state-title">No Execution Runs Found</h4>
            <p className="empty-state-desc">
              No pipeline executions match the current filter criteria or have been recorded yet.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                {showPipelineColumn && <th>Pipeline</th>}
                <th>Trigger</th>
                <th>Sync Mode</th>
                <th style={{ textAlign: 'right' }}>Extracted</th>
                <th style={{ textAlign: 'right' }}>Transformed</th>
                <th style={{ textAlign: 'right' }}>Loaded</th>
                <th>Duration</th>
                <th>Started At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const isSuccess = run.status === 'SUCCESS';
                const isFailed = run.status === 'FAILED';
                const isRunning = run.status === 'RUNNING';
                const pipelineName = pipelineMap[run.pipelineId] || null;

                return (
                  <tr key={run.id}>
                    {/* Status Badge */}
                    <td style={{ width: '100px' }}>
                      <span
                        className={`badge ${
                          isSuccess
                            ? 'badge-success'
                            : isFailed
                            ? 'badge-danger'
                            : isRunning
                            ? 'badge-warning badge-pulse'
                            : 'badge-muted'
                        }`}
                        style={{ fontSize: '0.6875rem' }}
                      >
                        {run.status}
                      </span>
                    </td>

                    {/* Pipeline Column (Global View) */}
                    {showPipelineColumn && (
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {pipelineName ? (
                            <Link
                              to={`/pipelines/${run.pipelineId}`}
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                fontSize: '0.8125rem',
                                textDecoration: 'none'
                              }}
                              className="pipeline-name-link"
                            >
                              {pipelineName}
                            </Link>
                          ) : (
                            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                              Pipeline
                            </span>
                          )}
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            ID: <code>{run.pipelineId}</code>
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Trigger Type */}
                    <td>
                      <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                        {run.triggeredBy || 'MANUAL'}
                      </span>
                    </td>

                    {/* Sync Mode */}
                    <td>
                      <span
                        className={`badge ${run.syncMode === 'INCREMENTAL' ? 'badge-primary' : 'badge-muted'}`}
                        style={{ fontSize: '0.6875rem' }}
                      >
                        {run.syncMode || 'FULL'}
                      </span>
                    </td>

                    {/* Record Counts */}
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {formatNumber(run.recordsExtracted)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {formatNumber(run.recordsTransformed)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                      {formatNumber(run.recordsLoaded)}
                    </td>

                    {/* Execution Duration */}
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {formatDuration(run.startedAt, run.completedAt)}
                    </td>

                    {/* Started At Timestamp */}
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={formatDate(run.startedAt)}>
                      <div>{formatDate(run.startedAt)}</div>
                      <div style={{ fontSize: '0.6875rem' }}>{formatRelativeTime(run.startedAt)}</div>
                    </td>

                    {/* Action Button: View Details / Diagnostics */}
                    <td style={{ textAlign: 'right', width: '90px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleOpenDiagnostics(run)}
                        title="View execution diagnostics"
                        style={{
                          padding: '0.3125rem 0.5rem',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <FileText size={12} />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination & Limit Selectors Footer */}
      {runs.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.8125rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          {/* Limit Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Rows per page:</span>
            <select
              className="form-select"
              aria-label="Rows per page"
              value={pagination.limit || 10}
              onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}
              disabled={loading}
              style={{ width: 'auto', minWidth: '70px', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
            >
              {LIMIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Total: <strong>{pagination.total}</strong> runs
            </span>
          </div>

          {/* Page Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={pagination.page <= 1 || loading}
                onClick={() => onPageChange && onPageChange(pagination.page - 1)}
                style={{ padding: '0.3125rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => onPageChange && onPageChange(pagination.page + 1)}
                style={{ padding: '0.3125rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Diagnostics Drawer fallback if onSelectRun not provided */}
      {!onSelectRun && selectedRunForDrawer && (
        <RunDiagnosticsDrawer
          isOpen={Boolean(selectedRunForDrawer)}
          onClose={() => setSelectedRunForDrawer(null)}
          run={selectedRunForDrawer}
          pipelineName={pipelineMap[selectedRunForDrawer.pipelineId]}
        />
      )}
    </div>
  );
}

export default RunHistoryTable;
