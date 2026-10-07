import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Database,
  Sparkles,
  Server,
  RefreshCw,
  X,
  ShieldCheck,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import pipelineService from '../../services/pipeline.service.js';
import { formatDate, formatNumber, formatDuration } from '../../utils/formatters.js';

/**
 * Sanitize error messages to protect credentials, database URIs, passwords, and tokens
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
  // Redact credentials, passwords, api keys, and tokens
  sanitized = sanitized.replace(/(?:api[_-]?key|apikey|password|passwd|pwd|secret|token)["']?\s*[:=]\s*["']?[^"',;\s]+/gi, 'credential: [REDACTED]');
  return sanitized;
}

/**
 * Format live elapsed time into human-readable seconds or minutes
 */
function formatLiveElapsed(ms) {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}

export function ExecutionModal({
  isOpen,
  onClose,
  pipeline,
  onComplete
}) {
  // Execution status: 'IDLE' | 'STARTING' | 'RUNNING' | 'CONCURRENT_LOCKED' | 'SUCCESS' | 'FAILED'
  const [status, setStatus] = useState('IDLE');
  const [startTime, setStartTime] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [runResult, setRunResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Stage states: 'pending' | 'running' | 'completed' | 'failed'
  const [stageStates, setStageStates] = useState({
    extracted: 'pending',
    transformed: 'pending',
    loaded: 'pending'
  });

  // Polling state for HTTP 409 concurrency lock
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  // References for intervals and execution flags to prevent duplicate loops and memory leaks
  const timerIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const isExecutingRef = useRef(false);
  const isPollingActiveRef = useRef(false);

  // Clear timers safely
  const clearTimers = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    isPollingActiveRef.current = false;
    setIsPolling(false);
  }, []);

  // Stop elapsed timer
  const stopElapsedTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Poll for background / concurrent execution completion
  const startConcurrencyPolling = useCallback(() => {
    if (isPollingActiveRef.current || !pipeline?.id) return;

    isPollingActiveRef.current = true;
    setIsPolling(true);
    setPollCount(0);

    const maxPollAttempts = 30; // 30 * 2000ms = 60s max polling duration
    let attempts = 0;

    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      setPollCount(attempts);

      try {
        // 1. Check if pipeline is still running
        const pipeData = await pipelineService.getPipelineById(pipeline.id);
        const currentPipe = pipeData?.pipeline;

        if (currentPipe && !currentPipe.isRunning) {
          // Lock released! Fetch the most recent execution run for this pipeline
          clearTimers();
          stopElapsedTimer();

          const runsData = await pipelineService.getPipelineRuns(pipeline.id, { limit: 1 });
          const latestRun = runsData?.runs?.[0];

          if (latestRun) {
            setRunResult(latestRun);
            if (latestRun.status === 'SUCCESS') {
              setStatus('SUCCESS');
              setStageStates({
                extracted: 'completed',
                transformed: 'completed',
                loaded: 'completed'
              });
              if (onComplete) {
                onComplete({ success: true, run: latestRun });
              }
            } else if (latestRun.status === 'FAILED') {
              setStatus('FAILED');
              setStageStates({
                extracted: 'failed',
                transformed: 'failed',
                loaded: 'failed'
              });
              const safeErr = sanitizeErrorMessage(latestRun.errorMessage || 'Background execution failed.');
              setErrorMessage(safeErr);
              if (onComplete) {
                onComplete({ success: false, error: safeErr });
              }
            } else {
              setStatus('SUCCESS');
              if (onComplete) onComplete({ success: true, run: latestRun });
            }
          } else {
            setStatus('SUCCESS');
            if (onComplete) onComplete({ success: true });
          }
          return;
        }

        // Check if max polling attempts reached
        if (attempts >= maxPollAttempts) {
          clearTimers();
          stopElapsedTimer();
          setStatus('CONCURRENT_LOCKED');
          setErrorMessage(
            'Pipeline is taking longer than usual to complete. You may safely close this modal; the execution will finish in the background.'
          );
        }
      } catch (err) {
        // Suppress temporary network hiccups during polling
      }
    }, 2000);
  }, [pipeline?.id, clearTimers, stopElapsedTimer, onComplete]);

  // Main Execution Trigger
  const triggerExecution = useCallback(async () => {
    if (!pipeline?.id || isExecutingRef.current) return;

    isExecutingRef.current = true;
    const start = Date.now();
    setStartTime(start);
    setElapsedMs(0);
    setStatus('RUNNING');
    setErrorMessage(null);
    setRunResult(null);

    // Initial stage state: Extracted is running
    setStageStates({
      extracted: 'running',
      transformed: 'pending',
      loaded: 'pending'
    });

    // Start live elapsed timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 250);

    try {
      // Direct call to existing backend endpoint POST /api/pipelines/:id/run
      const res = await pipelineService.executePipeline(pipeline.id);
      stopElapsedTimer();

      const run = res.run;
      setRunResult(run);
      setStatus('SUCCESS');

      // Mark all stages completed
      setStageStates({
        extracted: 'completed',
        transformed: 'completed',
        loaded: 'completed'
      });

      if (onComplete) {
        onComplete({ success: true, run });
      }
    } catch (err) {
      const isConcurrency =
        err.status === 409 ||
        (err.message && (err.message.toLowerCase().includes('running') || err.message.toLowerCase().includes('concurrent')));

      if (isConcurrency) {
        // Concurrency lock detected (HTTP 409)
        setStatus('CONCURRENT_LOCKED');
        setErrorMessage(
          'Pipeline is currently locked: Another manual or scheduled execution is already running.'
        );
        // Start polling to detect when the concurrent background execution finishes
        startConcurrencyPolling();
      } else {
        stopElapsedTimer();
        setStatus('FAILED');
        const safeMsg = sanitizeErrorMessage(err.message || 'Pipeline execution failed');
        setErrorMessage(safeMsg);

        setStageStates({
          extracted: 'failed',
          transformed: 'failed',
          loaded: 'failed'
        });

        if (onComplete) {
          onComplete({ success: false, error: safeMsg });
        }
      }
    } finally {
      isExecutingRef.current = false;
    }
  }, [pipeline?.id, stopElapsedTimer, startConcurrencyPolling, onComplete]);

  // Trigger execution when modal opens in IDLE state
  useEffect(() => {
    if (isOpen && status === 'IDLE' && pipeline) {
      if (pipeline.status !== 'ACTIVE') {
        setStatus('FAILED');
        setErrorMessage('Pipeline is not active. Activate the pipeline to run it.');
        setStageStates({
          extracted: 'failed',
          transformed: 'failed',
          loaded: 'failed'
        });
      } else {
        triggerExecution();
      }
    }
  }, [isOpen, status, pipeline, triggerExecution]);

  // Clean up all intervals on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const isInFlight = status === 'RUNNING' || isPolling;
  const isSuccess = status === 'SUCCESS';
  const isFailed = status === 'FAILED';

  // Escape key handler to close modal when not in-flight
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isInFlight) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isInFlight, onClose]);

  if (!isOpen) return null;
  const isLocked = status === 'CONCURRENT_LOCKED';

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        // Allow clicking outside only if not currently in-flight
        if (e.target === e.currentTarget && !isInFlight) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="execution-modal-title"
    >
      <div className="modal-container execution-modal-container" style={{ maxWidth: '580px' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isSuccess
                  ? 'var(--success-bg)'
                  : isFailed
                  ? 'var(--danger-bg)'
                  : isLocked
                  ? 'var(--warning-bg)'
                  : 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSuccess
                  ? 'var(--success)'
                  : isFailed
                  ? 'var(--danger)'
                  : isLocked
                  ? 'var(--warning)'
                  : 'var(--primary)'
              }}
            >
              {isSuccess ? (
                <CheckCircle2 size={18} />
              ) : isFailed ? (
                <XCircle size={18} />
              ) : isLocked ? (
                <AlertTriangle size={18} />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
            </div>
            <div>
              <h3 id="execution-modal-title" className="card-title" style={{ fontSize: '1rem', margin: 0 }}>
                {isSuccess
                  ? 'Execution Completed'
                  : isFailed
                  ? 'Execution Failed'
                  : isLocked
                  ? 'Execution in Progress'
                  : 'Executing Pipeline'}
              </h3>
              <p className="card-subtitle" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                Pipeline: <strong style={{ color: 'var(--text-primary)' }}>{pipeline?.name}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              className={`badge ${
                isSuccess
                  ? 'badge-success'
                  : isFailed
                  ? 'badge-danger'
                  : isLocked
                  ? 'badge-warning badge-pulse'
                  : 'badge-primary badge-pulse'
              }`}
              style={{ fontSize: '0.6875rem' }}
            >
              {status}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isInFlight}
              style={{ padding: '0.25rem', height: '28px', width: '28px' }}
              title={isInFlight ? 'Execution in progress...' : 'Close modal'}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Live Timer and Execution Metadata Ribbon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <Clock size={16} color="var(--primary)" />
              <span style={{ color: 'var(--text-muted)' }}>Elapsed Time:</span>
              <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                {runResult?.completedAt && runResult?.startedAt
                  ? formatDuration(runResult.startedAt, runResult.completedAt)
                  : formatLiveElapsed(elapsedMs)}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
              <span className="badge badge-muted">Trigger: MANUAL</span>
              <span className="badge badge-info">Mode: {pipeline?.syncMode || 'FULL'}</span>
            </div>
          </div>

          {/* Real-time Stage Indicators Stepper (Extracted → Transformed → Loaded) */}
          <div style={{ padding: '0.5rem 0' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem'
              }}
            >
              Pipeline Execution Stages
            </div>

            <div className="execution-stepper">
              {/* Stage 1: Extracted */}
              <div className="execution-step">
                <div
                  className={`execution-step-icon ${stageStates.extracted}`}
                  title={`Extraction stage: ${stageStates.extracted}`}
                >
                  {stageStates.extracted === 'completed' ? (
                    <CheckCircle2 size={18} />
                  ) : stageStates.extracted === 'running' ? (
                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                  ) : stageStates.extracted === 'failed' ? (
                    <XCircle size={18} />
                  ) : (
                    <Database size={16} />
                  )}
                </div>
                <div className="execution-step-info">
                  <div className="execution-step-title">1. Extracted</div>
                  <div className="execution-step-desc">
                    {stageStates.extracted === 'completed'
                      ? `${formatNumber(runResult?.recordsExtracted ?? 0)} records`
                      : stageStates.extracted === 'running'
                      ? 'Fetching from source...'
                      : stageStates.extracted === 'failed'
                      ? 'Extraction failed'
                      : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Stage Connector 1 */}
              <div
                className={`execution-step-connector ${
                  stageStates.extracted === 'completed'
                    ? 'completed'
                    : stageStates.extracted === 'running'
                    ? 'running'
                    : ''
                }`}
              ></div>

              {/* Stage 2: Transformed */}
              <div className="execution-step">
                <div
                  className={`execution-step-icon ${stageStates.transformed}`}
                  title={`Transformation stage: ${stageStates.transformed}`}
                >
                  {stageStates.transformed === 'completed' ? (
                    <CheckCircle2 size={18} />
                  ) : stageStates.transformed === 'running' ? (
                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                  ) : stageStates.transformed === 'failed' ? (
                    <XCircle size={18} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </div>
                <div className="execution-step-info">
                  <div className="execution-step-title">2. Transformed</div>
                  <div className="execution-step-desc">
                    {stageStates.transformed === 'completed'
                      ? `${formatNumber(runResult?.recordsTransformed ?? 0)} records`
                      : stageStates.transformed === 'running'
                      ? 'Applying mappings...'
                      : stageStates.transformed === 'failed'
                      ? 'Transform failed'
                      : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Stage Connector 2 */}
              <div
                className={`execution-step-connector ${
                  stageStates.transformed === 'completed'
                    ? 'completed'
                    : stageStates.transformed === 'running'
                    ? 'running'
                    : ''
                }`}
              ></div>

              {/* Stage 3: Loaded */}
              <div className="execution-step">
                <div
                  className={`execution-step-icon ${stageStates.loaded}`}
                  title={`Loading stage: ${stageStates.loaded}`}
                >
                  {stageStates.loaded === 'completed' ? (
                    <CheckCircle2 size={18} />
                  ) : stageStates.loaded === 'running' ? (
                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                  ) : stageStates.loaded === 'failed' ? (
                    <XCircle size={18} />
                  ) : (
                    <Server size={16} />
                  )}
                </div>
                <div className="execution-step-info">
                  <div className="execution-step-title">3. Loaded</div>
                  <div className="execution-step-desc">
                    {stageStates.loaded === 'completed'
                      ? `${formatNumber(runResult?.recordsLoaded ?? 0)} records`
                      : stageStates.loaded === 'running'
                      ? 'Writing to target...'
                      : stageStates.loaded === 'failed'
                      ? 'Load failed'
                      : 'Pending'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HTTP 409 Concurrency Lock Callout */}
          {isLocked && (
            <div
              className="auth-alert-error"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--warning-border)',
                color: 'var(--text-primary)',
                padding: '0.875rem 1rem'
              }}
              role="alert"
            >
              <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1, fontSize: '0.8125rem' }}>
                <strong style={{ color: 'var(--warning)', display: 'block', marginBottom: '0.25rem' }}>
                  Execution Concurrency Guard Active
                </strong>
                <span>
                  {errorMessage || 'Another execution is currently in progress for this pipeline.'}
                </span>
                {isPolling && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <span className="spinner" style={{ width: '14px', height: '14px' }}></span>
                    <span>Monitoring background progress (poll attempt #{pollCount})...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Failure Alert Box with Sanitized Diagnostics */}
          {isFailed && errorMessage && !isLocked && (
            <div className="auth-alert-error" role="alert" style={{ fontSize: '0.8125rem' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Execution Diagnostic:</strong>
                <div style={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                  {errorMessage}
                </div>
              </div>
            </div>
          )}

          {/* Execution Metrics Summary Grid (Visible when Completed or Locked) */}
          {runResult && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-app)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>EXTRACTED</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {formatNumber(runResult.recordsExtracted)}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>TRANSFORMED</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {formatNumber(runResult.recordsTransformed)}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>LOADED</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>
                  {formatNumber(runResult.recordsLoaded)}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>DURATION</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                  {formatDuration(runResult.startedAt, runResult.completedAt)}
                </div>
              </div>
            </div>
          )}

          {/* Privacy & Zero-Credential Exposure Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '0.75rem'
            }}
          >
            <ShieldCheck size={14} color="var(--success)" style={{ flexShrink: 0 }} />
            <span>Connection credentials, URIs, and authentication tokens are masked and protected.</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isInFlight}
          >
            {isSuccess ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExecutionModal;
