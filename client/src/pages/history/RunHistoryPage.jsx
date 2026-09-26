import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  RefreshCw,
  Filter,
  Workflow,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Layers
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import pipelineRunService from '../../services/pipelineRun.service.js';
import pipelineService from '../../services/pipeline.service.js';
import RunHistoryTable from '../../components/pipeline/RunHistoryTable.jsx';
import RunDiagnosticsDrawer from '../../components/pipeline/RunDiagnosticsDrawer.jsx';
import { useToast } from '../../hooks/useToast.js';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'RUNNING', label: 'Running' }
];

export function RunHistoryPage() {
  const toast = useToast();

  // Primary State
  const [runs, setRuns] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Pagination & Limit State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  // Filters State
  const [selectedPipelineId, setSelectedPipelineId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Diagnostics Drawer State
  const [selectedRun, setSelectedRun] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 1. Fetch User Pipelines for the Pipeline Filter Dropdown & Pipeline Name Map
  const fetchPipelines = useCallback(async () => {
    try {
      const data = await pipelineService.getPipelines();
      setPipelines(data.pipelines || []);
    } catch {
      // Non-fatal if pipelines dropdown fails to load
    }
  }, []);

  // Map of pipelineId -> pipelineName
  const pipelineMap = useMemo(() => {
    const map = {};
    for (const p of pipelines) {
      map[p.id] = p.name;
    }
    return map;
  }, [pipelines]);

  // 2. Fetch Global Run History with Pagination and optional Pipeline filter
  const fetchRuns = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const params = {
          page,
          limit
        };

        if (selectedPipelineId !== 'ALL') {
          params.pipelineId = selectedPipelineId;
        }

        const data = await pipelineRunService.getRuns(params);
        setRuns(data.runs || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
        if (isManual) {
          toast.success('Run history refreshed');
        }
      } catch (err) {
        const msg = err.message || 'Failed to retrieve execution runs.';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, limit, selectedPipelineId, toast]
  );

  // Initial Load & pipeline fetch
  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Client-side filtering by status (ALL, SUCCESS, FAILED, RUNNING)
  const filteredRuns = useMemo(() => {
    if (selectedStatus === 'ALL') return runs;
    return runs.filter((r) => r.status === selectedStatus);
  }, [runs, selectedStatus]);

  // Handlers for Pagination
  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1); // Reset to page 1 on limit change
  };

  // Handler for opening run diagnostics drawer
  const handleSelectRun = (run) => {
    setSelectedRun(run);
    setIsDrawerOpen(true);
  };

  return (
    <div className="run-history-page">
      {/* Page Header */}
      <PageHeader
        title="Run History"
        subtitle="Audit log of all pipeline executions across your tenant"
        breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Run History' }]}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchRuns(true)}
              disabled={loading || isRefreshing}
              title="Refresh runs"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'badge-pulse' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        }
      />

      {/* Filter Toolbar Card */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem'
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Status Filter Tabs / Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((tab) => {
              const isSelected = selectedStatus === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedStatus(tab.value)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.375rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem'
                  }}
                >
                  {tab.value === 'SUCCESS' && <CheckCircle2 size={13} />}
                  {tab.value === 'FAILED' && <XCircle size={13} />}
                  {tab.value === 'RUNNING' && <Clock size={13} />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Pipeline Dropdown Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Pipeline:</span>
            <select
              className="form-select"
              aria-label="Filter runs by pipeline"
              value={selectedPipelineId}
              onChange={(e) => {
                setSelectedPipelineId(e.target.value);
                setPage(1); // Reset to page 1 on filter change
              }}
              style={{ width: 'auto', minWidth: '180px', maxWidth: '260px' }}
            >
              <option value="ALL">All Pipelines ({pipelines.length})</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Runs Data Table Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="var(--primary)" />
              <span>Execution Runs</span>
            </h3>
            <p className="card-subtitle">
              Showing {filteredRuns.length} of {pagination.total} execution records
            </p>
          </div>
          <span className="badge badge-muted">
            {pagination.total} Total
          </span>
        </div>

        <RunHistoryTable
          runs={filteredRuns}
          loading={loading}
          error={error}
          pagination={pagination}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          showPipelineColumn={true}
          pipelineMap={pipelineMap}
          onRetry={() => fetchRuns(false)}
          onSelectRun={handleSelectRun}
        />
      </div>

      {/* Execution Diagnostics Drawer */}
      {selectedRun && (
        <RunDiagnosticsDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedRun(null);
          }}
          run={selectedRun}
          pipelineName={pipelineMap[selectedRun.pipelineId]}
        />
      )}
    </div>
  );
}

export default RunHistoryPage;
