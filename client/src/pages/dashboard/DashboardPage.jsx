import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  Zap,
  ArrowRight,
  AlertTriangle,
  Play,
  Calendar,
  Layers
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import pipelineService from '../../services/pipeline.service.js';
import pipelineRunService from '../../services/pipelineRun.service.js';
import { formatNumber, formatDate, formatRelativeTime, formatDuration } from '../../utils/formatters.js';
import { useToast } from '../../hooks/useToast.js';

export function DashboardPage() {
  const toast = useToast();
  const [pipelines, setPipelines] = useState([]);
  const [runs, setRuns] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch pipelines and recent execution runs concurrently
      const [pipelinesRes, runsRes] = await Promise.allSettled([
        pipelineService.getPipelines(),
        pipelineRunService.getRuns({ limit: 10 })
      ]);

      if (pipelinesRes.status === 'fulfilled' && pipelinesRes.value) {
        setPipelines(pipelinesRes.value.pipelines || []);
      } else if (pipelinesRes.status === 'rejected') {
        throw new Error(pipelinesRes.reason?.message || 'Failed to fetch pipelines');
      }

      if (runsRes.status === 'fulfilled' && runsRes.value) {
        setRuns(runsRes.value.runs || []);
        setPagination(runsRes.value.pagination || null);
      } else if (runsRes.status === 'rejected') {
        throw new Error(runsRes.reason?.message || 'Failed to fetch execution runs');
      }

      if (isManualRefresh) {
        toast.success('Dashboard metrics refreshed');
      }
    } catch (err) {
      const msg = err.message || 'Unable to load dashboard data. Is the backend running?';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Derived Metrics (strictly based on existing backend endpoints)
  const activePipelines = pipelines.filter((p) => p.status === 'ACTIVE');
  const scheduledPipelines = pipelines.filter((p) => p.schedule && p.schedule.enabled);

  // Total loaded records computed across loaded run history
  const totalRecordsLoaded = runs.reduce((acc, curr) => acc + (Number(curr.recordsLoaded) || 0), 0);
  const totalRecordsExtracted = runs.reduce((acc, curr) => acc + (Number(curr.recordsExtracted) || 0), 0);

  // Success rate calculated across completed runs (SUCCESS vs FAILED)
  const completedRuns = runs.filter((r) => r.status === 'SUCCESS' || r.status === 'FAILED');
  const successRuns = runs.filter((r) => r.status === 'SUCCESS');
  const successRate = completedRuns.length > 0
    ? Math.round((successRuns.length / completedRuns.length) * 100)
    : null;

  // Pipeline lookup map by ID
  const pipelineMap = new Map(pipelines.map((p) => [p.id, p]));

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <PageHeader
        title="Ingestion Dashboard"
        subtitle="Real-time metrics, active pipeline schedules, and execution health"
        breadcrumbs={[{ label: 'Home' }, { label: 'Dashboard' }]}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchDashboardData(true)}
            disabled={loading || isRefreshing}
            id="btn-refresh-dashboard"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'badge-pulse' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="auth-alert-error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Connection Error:</strong> {error}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchDashboardData()}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Primary KPI Cards */}
      <div className="metrics-grid">
        {/* KPI 1: Active Pipelines */}
        <div className="metric-card">
          <div className="metric-card-header">
            <span className="metric-title">Active Pipelines</span>
            <div className="metric-icon-box" aria-hidden="true">
              <Zap size={18} />
            </div>
          </div>
          <div className="metric-value">
            {loading ? <span className="spinner"></span> : activePipelines.length}
          </div>
          <div className="metric-subtitle">
            <span className="badge badge-success">
              {pipelines.length} Total Configured
            </span>
          </div>
        </div>

        {/* KPI 2: Records Ingested */}
        <div className="metric-card">
          <div className="metric-card-header">
            <span className="metric-title">Records Loaded</span>
            <div className="metric-icon-box" aria-hidden="true">
              <Database size={18} />
            </div>
          </div>
          <div className="metric-value">
            {loading ? <span className="spinner"></span> : formatNumber(totalRecordsLoaded)}
          </div>
          <div className="metric-subtitle">
            <span className="badge badge-info">
              {formatNumber(totalRecordsExtracted)} Extracted
            </span>
          </div>
        </div>

        {/* KPI 3: Success Rate */}
        <div className="metric-card">
          <div className="metric-card-header">
            <span className="metric-title">Success Rate</span>
            <div className="metric-icon-box" aria-hidden="true">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="metric-value">
            {loading ? (
              <span className="spinner"></span>
            ) : successRate !== null ? (
              `${successRate}%`
            ) : (
              '100%'
            )}
          </div>
          <div className="metric-subtitle">
            <span className={`badge ${successRate === null || successRate >= 90 ? 'badge-success' : 'badge-warning'}`}>
              {completedRuns.length} Evaluated Runs
            </span>
          </div>
        </div>

        {/* KPI 4: Recent Executions */}
        <div className="metric-card">
          <div className="metric-card-header">
            <span className="metric-title">Recent Executions</span>
            <div className="metric-icon-box" aria-hidden="true">
              <Activity size={18} />
            </div>
          </div>
          <div className="metric-value">
            {loading ? <span className="spinner"></span> : pagination?.total ?? runs.length}
          </div>
          <div className="metric-subtitle">
            <span className="badge badge-muted">
              {scheduledPipelines.length} Schedules Active
            </span>
          </div>
        </div>
      </div>

      {/* 2 Main Dashboard Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Widget 1: Active Schedules Widget */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="var(--primary)" />
                Active Schedules
              </h3>
              <p className="card-subtitle">Automated background sync cycles</p>
            </div>
            <span className="badge badge-info">
              {scheduledPipelines.length} Enabled
            </span>
          </div>

          <div className="card-body" style={{ flex: 1, padding: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
                <span className="spinner spinner-lg"></span>
              </div>
            ) : scheduledPipelines.length === 0 ? (
              <div className="empty-state">
                <Clock size={32} className="empty-state-icon" />
                <h4 className="empty-state-title">No Active Schedules</h4>
                <p className="empty-state-desc">
                  Pipelines configured with recurring intervals or cron triggers will appear here.
                </p>
              </div>
            ) : (
              <div style={{ divideY: '1px solid var(--border-subtle)' }}>
                {scheduledPipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                          {pipeline.name}
                        </span>
                        <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                          {pipeline.syncMode || 'FULL'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        Type: <strong>{pipeline.schedule?.type}</strong> ({pipeline.schedule?.expression})
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Next Run:
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 500 }}>
                        {formatRelativeTime(pipeline.schedule?.nextRunAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Widget 2: System Status & Connectors Overview */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="var(--accent)" />
                Engine Overview
              </h3>
              <p className="card-subtitle">Connectors & Pipeline Health</p>
            </div>
            <span className="badge badge-success">
              Operational
            </span>
          </div>

          <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Supported Sources</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>REST API</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Supported Destinations</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>MongoDB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Transformation Engine</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--success)' }}>Active (P0–P12)</span>
              </div>
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              All pipeline executions enforce single-run concurrency locks (HTTP 409 guard) and secure credential isolation across tenant boundaries.
            </div>
          </div>
        </div>
      </div>

      {/* Widget 3: Recent Executions Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="var(--primary)" />
              Recent Pipeline Executions
            </h3>
            <p className="card-subtitle">Latest batch execution history and diagnostics</p>
          </div>
          <span className="badge badge-muted">
            {runs.length} Most Recent
          </span>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner spinner-lg"></span>
            </div>
          ) : runs.length === 0 ? (
            <div className="empty-state">
              <Activity size={32} className="empty-state-icon" />
              <h4 className="empty-state-title">No Pipeline Executions Found</h4>
              <p className="empty-state-desc">
                When pipelines run manually or via scheduled cron triggers, their execution metrics and records loaded will be audited here.
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Pipeline</th>
                  <th>Sync Mode</th>
                  <th>Trigger</th>
                  <th>Extracted</th>
                  <th>Transformed</th>
                  <th>Loaded</th>
                  <th>Duration</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const pipeline = pipelineMap.get(run.pipelineId);
                  const pipelineName = pipeline?.name || `Pipeline ${run.pipelineId?.slice(-6) || ''}`;

                  let statusBadge = <span className="badge badge-muted">{run.status}</span>;
                  if (run.status === 'SUCCESS') {
                    statusBadge = <span className="badge badge-success">Success</span>;
                  } else if (run.status === 'FAILED') {
                    statusBadge = <span className="badge badge-danger">Failed</span>;
                  } else if (run.status === 'RUNNING') {
                    statusBadge = (
                      <span className="badge badge-running">
                        <span className="badge-dot badge-pulse"></span> Running
                      </span>
                    );
                  }

                  return (
                    <tr key={run.id}>
                      <td>{statusBadge}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {pipelineName}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                          {run.syncMode || 'FULL'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {run.triggeredBy || 'MANUAL'}
                        </span>
                      </td>
                      <td>{formatNumber(run.recordsExtracted)}</td>
                      <td>{formatNumber(run.recordsTransformed)}</td>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {formatNumber(run.recordsLoaded)}
                        </strong>
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {formatDuration(run.startedAt, run.completedAt)}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={formatDate(run.startedAt)}>
                        {formatRelativeTime(run.startedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
