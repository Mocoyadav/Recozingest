import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Workflow,
  Plus,
  RefreshCw,
  Search,
  Database,
  Server,
  Layers,
  Calendar,
  Clock,
  Trash2,
  AlertTriangle,
  Play,
  Sliders,
  CheckCircle2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import pipelineService from '../../services/pipeline.service.js';
import { formatDate, formatRelativeTime } from '../../utils/formatters.js';
import { useToast } from '../../hooks/useToast.js';
import ExecutionModal from '../../components/pipeline/ExecutionModal.jsx';

export function PipelinesListPage() {
  const toast = useToast();

  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [syncModeFilter, setSyncModeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Deletion Modal
  const [deletingPipeline, setDeletingPipeline] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Manual Execution Modal
  const [executingPipeline, setExecutingPipeline] = useState(null);

  // Status Toggling Tracking
  const [togglingId, setTogglingId] = useState(null);

  // Fetch pipelines
  const fetchPipelines = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await pipelineService.getPipelines();
      setPipelines(data.pipelines || []);
      if (isManualRefresh) {
        toast.success('Pipelines refreshed');
      }
    } catch (err) {
      const msg = err.message || 'Failed to retrieve pipelines.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  // Escape key closes delete modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && deletingPipeline && !isDeleting) {
        setDeletingPipeline(null);
      }
    };
    if (deletingPipeline) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletingPipeline, isDeleting]);

  // Toggle pipeline status (ACTIVE / INACTIVE) using PUT /api/pipelines/:id
  const handleToggleStatus = async (pipeline) => {
    const newStatus = pipeline.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setTogglingId(pipeline.id);

    try {
      const res = await pipelineService.updatePipeline(pipeline.id, { status: newStatus });
      setPipelines((prev) =>
        prev.map((p) => (p.id === pipeline.id ? { ...p, status: res.pipeline.status } : p))
      );
      toast.success(`Pipeline "${pipeline.name}" marked ${newStatus}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update pipeline status.');
    } finally {
      setTogglingId(null);
    }
  };

  // Delete pipeline execution
  const handleDeletePipeline = async () => {
    if (!deletingPipeline) return;

    setIsDeleting(true);
    try {
      await pipelineService.deletePipeline(deletingPipeline.id);
      toast.success(`Pipeline "${deletingPipeline.name}" deleted successfully.`);
      setPipelines((prev) => prev.filter((p) => p.id !== deletingPipeline.id));
      setDeletingPipeline(null);
    } catch (err) {
      toast.error(err.message || 'Failed to delete pipeline.');
    } finally {
      setIsDeleting(false);
    }
  };

  // In-memory search & filter
  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      // Sync Mode filter
      if (syncModeFilter !== 'ALL' && p.syncMode !== syncModeFilter) return false;
      // Status filter
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      // Search query filter (matches pipeline name, source name, or destination name)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesSource = p.source?.name?.toLowerCase().includes(query);
        const matchesDestination = p.destination?.name?.toLowerCase().includes(query);
        return matchesName || matchesSource || matchesDestination;
      }
      return true;
    });
  }, [pipelines, syncModeFilter, statusFilter, searchQuery]);

  return (
    <div className="pipelines-page">
      {/* Page Header */}
      <PageHeader
        title="Pipelines"
        subtitle="Orchestrate end-to-end data workflows from sources to destinations"
        breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Pipelines' }]}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchPipelines(true)}
              disabled={loading || isRefreshing}
              title="Refresh pipelines"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'badge-pulse' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <Link
              to="/pipelines/new"
              className="btn btn-primary"
              id="btn-new-pipeline"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', textDecoration: 'none' }}
            >
              <Plus size={16} />
              <span>New Pipeline</span>
            </Link>
          </div>
        }
      />

      {/* Error Alert with Retry */}
      {error && (
        <div className="auth-alert-error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Unable to Load Pipelines:</strong> {error}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchPipelines()}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem'
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '400px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              className="form-control"
              aria-label="Search pipelines"
              placeholder="Search by pipeline, source, or destination..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          {/* Sync Mode Filter */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Mode:</span>
              <select
                className="form-select"
                aria-label="Filter by sync mode"
                style={{ width: 'auto', minWidth: '130px' }}
                value={syncModeFilter}
                onChange={(e) => setSyncModeFilter(e.target.value)}
              >
                <option value="ALL">All Modes</option>
                <option value="FULL">FULL</option>
                <option value="INCREMENTAL">INCREMENTAL</option>
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Status:</span>
              <select
                className="form-select"
                aria-label="Filter by status"
                style={{ width: 'auto', minWidth: '110px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Pipelines Data Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Workflow size={18} color="var(--primary)" />
              Configured Pipelines
            </h3>
            <p className="card-subtitle">
              {filteredPipelines.length} of {pipelines.length} pipelines matched
            </p>
          </div>
          <span className="badge badge-muted">
            {pipelines.length} Total
          </span>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
              <span className="spinner spinner-lg"></span>
            </div>
          ) : filteredPipelines.length === 0 ? (
            <div className="empty-state">
              <Workflow size={36} className="empty-state-icon" />
              <h4 className="empty-state-title">
                {pipelines.length === 0 ? 'No Pipelines Configured' : 'No Pipelines Match Your Filter'}
              </h4>
              <p className="empty-state-desc">
                {pipelines.length === 0
                  ? 'Connect an existing data source to a destination with the Pipeline Creation Wizard.'
                  : 'Try adjusting your search criteria or resetting filters.'}
              </p>
              {pipelines.length === 0 && (
                <Link
                  to="/pipelines/new"
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                >
                  <Plus size={16} />
                  <span>Create Your First Pipeline</span>
                </Link>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Pipeline Name</th>
                  <th>Source &rarr; Destination</th>
                  <th>Sync Mode</th>
                  <th>Schedule</th>
                  <th>Transformations</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPipelines.map((pipeline) => {
                  const isActive = pipeline.status === 'ACTIVE';
                  const isScheduled = Boolean(pipeline.schedule?.enabled);
                  const hasTransformations = Boolean(pipeline.transformations?.enabled);

                  return (
                    <tr key={pipeline.id}>
                      {/* Status Toggle & Badge */}
                      <td style={{ width: '110px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label className="switch" title={`Toggle status (currently ${pipeline.status})`}>
                            <input
                              type="checkbox"
                              className="switch-input"
                              checked={isActive}
                              onChange={() => handleToggleStatus(pipeline)}
                              disabled={togglingId === pipeline.id}
                            />
                            <span className="switch-track">
                              <span className="switch-thumb"></span>
                            </span>
                          </label>
                          <span
                            className={`badge ${isActive ? 'badge-success' : 'badge-muted'}`}
                            style={{ fontSize: '0.6875rem' }}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>

                      {/* Name & ID */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <Link
                            to={`/pipelines/${pipeline.id}`}
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              fontSize: '0.875rem',
                              textDecoration: 'none'
                            }}
                            className="pipeline-name-link"
                          >
                            {pipeline.name}
                          </Link>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            ID: {pipeline.id}
                          </span>
                        </div>
                      </td>

                      {/* Source & Destination Tags */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <span
                            className="badge badge-info"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem' }}
                          >
                            <Database size={10} />
                            {pipeline.source?.name || 'Source'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>&rarr;</span>
                          <span
                            className="badge badge-success"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem' }}
                          >
                            <Server size={10} />
                            {pipeline.destination?.name || 'Destination'}
                          </span>
                        </div>
                      </td>

                      {/* Sync Mode */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span
                            className={`badge ${pipeline.syncMode === 'INCREMENTAL' ? 'badge-primary' : 'badge-muted'}`}
                            style={{ fontSize: '0.6875rem', alignSelf: 'flex-start' }}
                          >
                            {pipeline.syncMode || 'FULL'}
                          </span>
                          {pipeline.syncMode === 'INCREMENTAL' && pipeline.cursorField && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              cursor: <code>{pipeline.cursorField}</code>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Schedule */}
                      <td>
                        {isScheduled ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span
                              className="badge badge-info"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem', alignSelf: 'flex-start' }}
                            >
                              <Calendar size={10} />
                              {pipeline.schedule?.type}: {pipeline.schedule?.expression}
                            </span>
                            {pipeline.schedule?.nextRunAt && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--accent)' }}>
                                Next: {formatRelativeTime(pipeline.schedule.nextRunAt)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                            Disabled
                          </span>
                        )}
                      </td>

                      {/* Transformations */}
                      <td>
                        {hasTransformations ? (
                          <span
                            className="badge badge-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem' }}
                          >
                            <Sparkles size={10} />
                            Active ({pipeline.transformations?.fieldMappings?.length || 0} rules)
                          </span>
                        ) : (
                          <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                            Pass-through
                          </span>
                        )}
                      </td>

                      {/* Created */}
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={formatDate(pipeline.createdAt)}>
                        {formatRelativeTime(pipeline.createdAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', width: '120px' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setExecutingPipeline(pipeline)}
                            title="Run pipeline now"
                            aria-label={`Run ${pipeline.name}`}
                            style={{
                              padding: '0.375rem',
                              height: '30px',
                              width: '30px',
                              color: 'var(--primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Play size={13} fill="currentColor" />
                          </button>
                          <Link
                            to={`/pipelines/${pipeline.id}`}
                            className="btn btn-secondary"
                            title="View Pipeline Details"
                            aria-label={`View ${pipeline.name} details`}
                            style={{
                              padding: '0.375rem',
                              height: '30px',
                              width: '30px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textDecoration: 'none'
                            }}
                          >
                            <Sliders size={14} />
                          </Link>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setDeletingPipeline(pipeline)}
                            title="Delete pipeline"
                            aria-label={`Delete ${pipeline.name}`}
                            style={{
                              padding: '0.375rem',
                              height: '30px',
                              width: '30px',
                              color: 'var(--danger)'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPipeline && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeletingPipeline(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-pipeline-title"
        >
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 id="delete-pipeline-title" className="card-title" style={{ color: 'var(--danger)' }}>
                Delete Pipeline
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to delete the pipeline{' '}
                <strong style={{ color: 'var(--text-primary)' }}>&quot;{deletingPipeline.name}&quot;</strong>?
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>
                This will terminate all associated recurring schedules. Historical execution audit runs will be preserved. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingPipeline(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeletePipeline}
                disabled={isDeleting}
                id="btn-confirm-delete-pipeline"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isDeleting ? (
                  <>
                    <span className="spinner"></span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Execution Modal */}
      {executingPipeline && (
        <ExecutionModal
          isOpen={Boolean(executingPipeline)}
          onClose={() => {
            setExecutingPipeline(null);
            fetchPipelines();
          }}
          pipeline={executingPipeline}
          onComplete={() => {
            fetchPipelines();
          }}
        />
      )}
    </div>
  );
}

export default PipelinesListPage;
