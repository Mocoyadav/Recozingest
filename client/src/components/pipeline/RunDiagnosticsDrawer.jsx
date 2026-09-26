import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Database,
  Server,
  Workflow,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Layers,
  ExternalLink
} from 'lucide-react';
import {
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatDuration
} from '../../utils/formatters.js';

/**
 * Sanitize error message to ensure no connection URIs, passwords, or tokens are leaked
 */
function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return 'An error occurred during pipeline execution.';
  let sanitized = msg;
  // Redact MongoDB connection URIs
  sanitized = sanitized.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, 'mongodb://[REDACTED]');
  // Redact generic URI credentials: scheme://user:password@host
  sanitized = sanitized.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@');
  // Redact Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  // Redact passwords, credentials, api keys, and tokens
  sanitized = sanitized.replace(/(?:api[_-]?key|apikey|password|passwd|pwd|secret|token)["']?\s*[:=]\s*["']?[^"',;\s]+/gi, 'credential: [REDACTED]');
  return sanitized;
}

export function RunDiagnosticsDrawer({
  isOpen,
  onClose,
  run,
  pipelineName = null
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !run) return null;

  const isSuccess = run.status === 'SUCCESS';
  const isFailed = run.status === 'FAILED';
  const isRunning = run.status === 'RUNNING';

  const sanitizedError = sanitizeErrorMessage(run.errorMessage);

  return (
    <div
      className="drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-diagnostics-title"
    >
      <div className="drawer-panel" style={{ maxWidth: '560px' }}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <FileText size={20} color="var(--primary)" />
            <div>
              <h3 id="run-diagnostics-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                Execution Diagnostics
              </h3>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Run ID: <code>{run.id}</code>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: '0.25rem', height: '28px', width: '28px' }}
              title="Close diagnostics"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Status Ribbon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isSuccess
                ? 'var(--success-bg)'
                : isFailed
                ? 'var(--danger-bg)'
                : 'var(--warning-bg)',
              border: `1px solid ${
                isSuccess
                  ? 'var(--success-border)'
                  : isFailed
                  ? 'var(--danger-border)'
                  : 'var(--warning-border)'
              }`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isSuccess ? (
                <CheckCircle2 size={20} color="var(--success)" />
              ) : isFailed ? (
                <XCircle size={20} color="var(--danger)" />
              ) : (
                <Clock size={20} color="var(--warning)" />
              )}
              <div>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {isSuccess
                    ? 'Pipeline Run Completed Successfully'
                    : isFailed
                    ? 'Pipeline Run Failed'
                    : 'Pipeline Run In Progress'}
                </strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Duration: {formatDuration(run.startedAt, run.completedAt)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                {run.triggeredBy || 'MANUAL'}
              </span>
              <span
                className={`badge ${run.syncMode === 'INCREMENTAL' ? 'badge-primary' : 'badge-muted'}`}
                style={{ fontSize: '0.6875rem' }}
              >
                {run.syncMode || 'FULL'}
              </span>
            </div>
          </div>

          {/* Pipeline Association */}
          <div
            style={{
              padding: '0.875rem 1rem',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Workflow size={18} color="var(--primary)" />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pipeline</div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {pipelineName || run.pipelineId || 'Unknown Pipeline'}
                </div>
              </div>
            </div>

            {run.pipelineId && (
              <Link
                to={`/pipelines/${run.pipelineId}`}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                title="Navigate to pipeline details"
              >
                <span>View Pipeline</span>
                <ExternalLink size={12} />
              </Link>
            )}
          </div>

          {/* Error Diagnostics (when failed or errorMessage present) */}
          {isFailed && run.errorMessage && (
            <div
              className="auth-alert-error"
              role="alert"
              style={{
                backgroundColor: 'var(--danger-bg)',
                borderColor: 'var(--danger-border)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <AlertTriangle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--danger)', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>
                    Failure Diagnostics
                  </strong>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-primary)',
                      wordBreak: 'break-word',
                      lineHeight: 1.4
                    }}
                  >
                    {sanitizedError}
                  </div>

                  {/* Expandable Technical Details */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: 0
                      }}
                    >
                      <span>{showTechnicalDetails ? 'Hide Technical Details' : 'Show Technical Details'}</span>
                      {showTechnicalDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {showTechnicalDetails && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.75rem',
                          backgroundColor: 'var(--bg-app)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {JSON.stringify(
                          {
                            runId: run.id,
                            pipelineId: run.pipelineId,
                            sourceType: run.sourceType,
                            destinationType: run.destinationType,
                            syncMode: run.syncMode,
                            diagnosticsTimestamp: run.completedAt || run.startedAt,
                            cursorBefore: run.cursorValueBefore,
                            cursorAfter: run.cursorValueAfter
                          },
                          null,
                          2
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Throughput Metrics Cards */}
          <div>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem'
              }}
            >
              Throughput & Records Summary
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.875rem 0.75rem',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>EXTRACTED</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {formatNumber(run.recordsExtracted)}
                </div>
              </div>

              <div
                style={{
                  padding: '0.875rem 0.75rem',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>TRANSFORMED</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {formatNumber(run.recordsTransformed)}
                </div>
              </div>

              <div
                style={{
                  padding: '0.875rem 0.75rem',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>LOADED</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>
                  {formatNumber(run.recordsLoaded)}
                </div>
              </div>
            </div>
          </div>

          {/* Granular Execution Details List */}
          <div>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem'
              }}
            >
              Execution Metadata
            </div>
            <div className="info-item-list" style={{ backgroundColor: 'var(--bg-app)', padding: '0.875rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div className="info-item-row">
                <span className="info-item-label">Source Connector:</span>
                <span className="info-item-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Database size={12} color="var(--primary)" />
                  {run.sourceType || '—'}
                </span>
              </div>
              <div className="info-item-row">
                <span className="info-item-label">Destination Target:</span>
                <span className="info-item-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Server size={12} color="var(--success)" />
                  {run.destinationType || '—'}
                </span>
              </div>
              <div className="info-item-row">
                <span className="info-item-label">Started At:</span>
                <span className="info-item-value">{formatDate(run.startedAt)} ({formatRelativeTime(run.startedAt)})</span>
              </div>
              <div className="info-item-row">
                <span className="info-item-label">Completed At:</span>
                <span className="info-item-value">{run.completedAt ? formatDate(run.completedAt) : 'In Progress'}</span>
              </div>
              {run.cursorField && (
                <div className="info-item-row">
                  <span className="info-item-label">Cursor Field:</span>
                  <span className="info-item-value"><code>{run.cursorField}</code></span>
                </div>
              )}
              {run.cursorValueBefore !== null && run.cursorValueBefore !== undefined && (
                <div className="info-item-row">
                  <span className="info-item-label">Cursor Value Before:</span>
                  <span className="info-item-value"><code>{String(run.cursorValueBefore)}</code></span>
                </div>
              )}
              {run.cursorValueAfter !== null && run.cursorValueAfter !== undefined && (
                <div className="info-item-row">
                  <span className="info-item-label">Cursor Value After:</span>
                  <span className="info-item-value" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    <code>{String(run.cursorValueAfter)}</code>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Security Shield Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              marginTop: 'auto'
            }}
          >
            <ShieldCheck size={16} color="var(--success)" style={{ flexShrink: 0 }} />
            <span>Connection credentials, passwords, URIs, and authentication tokens are masked by design.</span>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default RunDiagnosticsDrawer;
