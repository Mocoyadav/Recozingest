import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Workflow,
  Play,
  RefreshCw,
  Sliders,
  Calendar,
  Sparkles,
  Clock,
  Database,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Plus,
  Edit3,
  Layers,
  ShieldCheck,
  Eye,
  ArrowRight,
  RotateCcw,
  FileText,
  X,
  ExternalLink,
  Info
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import pipelineService from '../../services/pipeline.service.js';
import pipelineRunService from '../../services/pipelineRun.service.js';
import {
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatDuration
} from '../../utils/formatters.js';
import { useToast } from '../../hooks/useToast.js';
import ExecutionModal from '../../components/pipeline/ExecutionModal.jsx';
import RunHistoryTable from '../../components/pipeline/RunHistoryTable.jsx';

const DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON'];
const TRANSFORM_RULES = [
  { value: 'NONE', label: 'None (Direct Copy)' },
  { value: 'UPPERCASE', label: 'UPPERCASE' },
  { value: 'LOWERCASE', label: 'lowercase' },
  { value: 'TRIM', label: 'Trim Whitespace' },
  { value: 'MASK_REDACT', label: 'Mask / Redact (***)' },
  { value: 'MASK_HASH', label: 'Hash (SHA-256)' }
];

const INTERVAL_PRESETS = [
  { label: '15 mins', value: '15m' },
  { label: '30 mins', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '12 hours', value: '12h' },
  { label: '1 day', value: '1d' }
];

export function PipelineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  // Primary State
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active Tab: 'overview' | 'runs' | 'schedule' | 'transform'
  const [activeTab, setActiveTab] = useState('overview');

  // Manual Run Trigger State
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [lastRunBanner, setLastRunBanner] = useState(null);
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);

  // Quick Edit Pipeline Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', status: 'ACTIVE', syncMode: 'FULL', cursorField: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Checkpoint Reset State
  const [isResettingCursor, setIsResettingCursor] = useState(false);

  // Run History Tab State
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState(null);
  const [runsPage, setRunsPage] = useState(1);
  const [runsLimit, setRunsLimit] = useState(10);
  const [runsPagination, setRunsPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [selectedRun, setSelectedRun] = useState(null);
  const [runDrawerOpen, setRunDrawerOpen] = useState(false);

  // Schedule Tab State
  const [scheduleData, setScheduleData] = useState(null);
  const [scheduleType, setScheduleType] = useState('INTERVAL');
  const [scheduleExpr, setScheduleExpr] = useState('1h');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isTogglingSchedule, setIsTogglingSchedule] = useState(false);

  // Transformation Tab State
  const [transformConfig, setTransformConfig] = useState({
    enabled: false,
    includeUnmapped: true,
    addMetadata: false,
    fieldMappings: []
  });
  const [isSavingTransform, setIsSavingTransform] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // 1. Fetch Pipeline Core Details
  const fetchPipelineDetails = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await pipelineService.getPipelineById(id);
      const pipe = data.pipeline;
      setPipeline(pipe);

      // Populate edit form
      setEditForm({
        name: pipe.name || '',
        status: pipe.status || 'ACTIVE',
        syncMode: pipe.syncMode || 'FULL',
        cursorField: pipe.cursorField || ''
      });

      // Populate schedule state
      if (pipe.schedule) {
        setScheduleData(pipe.schedule);
        setScheduleType(pipe.schedule.type || 'INTERVAL');
        setScheduleExpr(pipe.schedule.expression || '1h');
        setScheduleEnabled(Boolean(pipe.schedule.enabled));
      }

      // Populate transformations state
      if (pipe.transformations) {
        setTransformConfig({
          enabled: Boolean(pipe.transformations.enabled),
          includeUnmapped: pipe.transformations.includeUnmapped !== false,
          addMetadata: Boolean(pipe.transformations.addMetadata),
          fieldMappings: Array.isArray(pipe.transformations.fieldMappings)
            ? pipe.transformations.fieldMappings.map((m) => ({ ...m }))
            : []
        });
      }

      if (isManual) {
        toast.success('Pipeline refreshed');
      }
    } catch (err) {
      const msg = err.message || 'Failed to retrieve pipeline details.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [id, toast]);

  // 2. Fetch Run History
  const fetchRunHistory = useCallback(async (pageToFetch = 1, limitToFetch = runsLimit) => {
    setRunsLoading(true);
    setRunsError(null);
    try {
      const data = await pipelineService.getPipelineRuns(id, { page: pageToFetch, limit: limitToFetch });
      setRuns(data.runs || []);
      if (data.pagination) {
        setRunsPagination(data.pagination);
        setRunsPage(data.pagination.page);
      }
    } catch (err) {
      setRunsError(err.message || 'Failed to retrieve run history.');
    } finally {
      setRunsLoading(false);
    }
  }, [id, runsLimit]);

  // Initial Load
  useEffect(() => {
    fetchPipelineDetails();
  }, [fetchPipelineDetails]);

  // Tab switch effect for Run History
  useEffect(() => {
    if (activeTab === 'runs') {
      fetchRunHistory(runsPage);
    }
  }, [activeTab, fetchRunHistory, runsPage]);

  // Escape key closes edit modal if not saving
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isEditModalOpen && !isSavingEdit) {
        setIsEditModalOpen(false);
      }
    };
    if (isEditModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, isSavingEdit]);

  // 3. Manual Run Execution via Interactive ExecutionModal
  const handleOpenExecutionModal = () => {
    if (isExecutionModalOpen || pipeline?.isRunning) {
      setIsExecutionModalOpen(true);
      return;
    }

    if (pipeline?.status !== 'ACTIVE') {
      toast.warning('This pipeline is currently Inactive. Activate it to trigger execution.');
      return;
    }

    setIsExecutionModalOpen(true);
  };

  const handleExecutionModalComplete = async (result) => {
    if (result?.success) {
      toast.success('Pipeline execution completed successfully!');
      if (result.run) {
        setLastRunBanner({
          type: 'success',
          message: 'Execution completed successfully.',
          run: result.run
        });
      }
    } else if (result?.error) {
      setLastRunBanner({
        type: 'error',
        message: result.error
      });
    }

    // Automatically refresh core pipeline details and run history
    await fetchPipelineDetails();
    if (activeTab === 'runs') {
      await fetchRunHistory(1);
    }
  };

  // 4. Quick Edit Pipeline Modal Submit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Pipeline name cannot be empty.');
      return;
    }
    if (editForm.syncMode === 'INCREMENTAL' && !editForm.cursorField.trim()) {
      toast.error('cursorField is required for INCREMENTAL sync mode.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        status: editForm.status,
        syncMode: editForm.syncMode,
        cursorField: editForm.syncMode === 'INCREMENTAL' ? editForm.cursorField.trim() : null
      };

      const res = await pipelineService.updatePipeline(pipeline.id, payload);
      setPipeline(res.pipeline);
      toast.success('Pipeline updated successfully.');
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update pipeline settings.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 5. Reset Cursor Value
  const handleResetCursor = async () => {
    if (!window.confirm('Reset cursor checkpoint? Next execution will re-sync from the initial baseline.')) {
      return;
    }

    setIsResettingCursor(true);
    try {
      const res = await pipelineService.updatePipeline(pipeline.id, { resetCursor: true });
      setPipeline(res.pipeline);
      toast.success('Checkpoint reset. Next sync will baseline from start.');
    } catch (err) {
      toast.error(err.message || 'Failed to reset checkpoint.');
    } finally {
      setIsResettingCursor(false);
    }
  };

  // 6. Toggle Schedule Enable/Disable
  const handleToggleScheduleEnable = async () => {
    setIsTogglingSchedule(true);
    try {
      let res;
      if (scheduleEnabled) {
        res = await pipelineService.disableSchedule(pipeline.id);
        setScheduleEnabled(false);
        toast.success('Schedule disabled.');
      } else {
        res = await pipelineService.enableSchedule(pipeline.id);
        setScheduleEnabled(true);
        toast.success('Schedule enabled.');
      }
      if (res.schedule) {
        setScheduleData(res.schedule);
        setPipeline((prev) => ({ ...prev, schedule: res.schedule }));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to toggle schedule state.');
    } finally {
      setIsTogglingSchedule(false);
    }
  };

  // 7. Save Schedule Configuration
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    const expr = scheduleExpr.trim();

    // Client-side validation
    if (scheduleType === 'INTERVAL') {
      const intervalRegex = /^\d+[smhd]$/;
      if (!intervalRegex.test(expr)) {
        toast.error('Invalid interval format. Use e.g. "15m", "1h", "2h", "1d".');
        return;
      }
    } else if (scheduleType === 'CRON') {
      const parts = expr.split(/\s+/).filter(Boolean);
      if (parts.length !== 5) {
        toast.error('Invalid cron expression. Expected 5 whitespace-separated segments (e.g. "*/15 * * * *").');
        return;
      }
    }

    setIsSavingSchedule(true);
    try {
      const res = await pipelineService.updateSchedule(pipeline.id, {
        type: scheduleType,
        expression: expr,
        enabled: scheduleEnabled
      });
      setScheduleData(res.schedule);
      setPipeline((prev) => ({ ...prev, schedule: res.schedule }));
      toast.success('Schedule configuration saved.');
    } catch (err) {
      toast.error(err.message || 'Failed to save schedule.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // 8. Transformation Editor Actions
  const handleAddMappingRow = () => {
    setTransformConfig((prev) => ({
      ...prev,
      fieldMappings: [
        ...prev.fieldMappings,
        {
          sourceField: '',
          destinationField: '',
          dataType: 'STRING',
          defaultValue: '',
          transformRule: 'NONE'
        }
      ]
    }));
  };

  const handleRemoveMappingRow = (index) => {
    setTransformConfig((prev) => ({
      ...prev,
      fieldMappings: prev.fieldMappings.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateMappingRow = (index, field, value) => {
    setTransformConfig((prev) => {
      const nextMappings = [...prev.fieldMappings];
      nextMappings[index] = { ...nextMappings[index], [field]: value };
      return { ...prev, fieldMappings: nextMappings };
    });
  };

  // Save Transformations
  const handleSaveTransformations = async () => {
    // Validate mappings
    for (let i = 0; i < transformConfig.fieldMappings.length; i++) {
      const m = transformConfig.fieldMappings[i];
      if (!m.sourceField || !m.sourceField.trim()) {
        toast.error(`Mapping row #${i + 1} is missing a sourceField.`);
        return;
      }
      if (!m.destinationField || !m.destinationField.trim()) {
        toast.error(`Mapping row #${i + 1} is missing a destinationField.`);
        return;
      }
    }

    setIsSavingTransform(true);
    try {
      const payload = {
        enabled: transformConfig.enabled,
        includeUnmapped: transformConfig.includeUnmapped,
        addMetadata: transformConfig.addMetadata,
        fieldMappings: transformConfig.fieldMappings.map((m) => ({
          sourceField: m.sourceField.trim(),
          destinationField: m.destinationField.trim(),
          dataType: m.dataType || null,
          defaultValue: m.defaultValue !== undefined && m.defaultValue !== '' ? m.defaultValue : null,
          transformRule: m.transformRule || 'NONE'
        }))
      };

      const res = await pipelineService.updateTransformations(pipeline.id, payload);
      setTransformConfig(res.transformations);
      setPipeline((prev) => ({ ...prev, transformations: res.transformations }));
      toast.success('Transformations updated successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to update transformations.');
    } finally {
      setIsSavingTransform(false);
    }
  };

  // Preview Transformations In-Memory
  const handlePreviewTransformations = async () => {
    setIsPreviewing(true);
    setPreviewResult(null);
    try {
      const res = await pipelineService.previewTransformations(pipeline.id, {
        transformations: {
          enabled: true,
          includeUnmapped: transformConfig.includeUnmapped,
          addMetadata: transformConfig.addMetadata,
          fieldMappings: transformConfig.fieldMappings.map((m) => ({
            sourceField: m.sourceField.trim(),
            destinationField: m.destinationField.trim(),
            dataType: m.dataType || null,
            defaultValue: m.defaultValue !== undefined && m.defaultValue !== '' ? m.defaultValue : null,
            transformRule: m.transformRule || 'NONE'
          }))
        }
      });
      setPreviewResult(res.preview);
      toast.success('Transformation preview generated in-memory.');
    } catch (err) {
      toast.error(err.message || 'Failed to generate transformation preview.');
    } finally {
      setIsPreviewing(false);
    }
  };

  // Render Loading State
  if (loading) {
    return (
      <div className="pipeline-detail-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <span className="spinner spinner-lg"></span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading pipeline configuration...</span>
      </div>
    );
  }

  // Render Error State
  if (error || !pipeline) {
    return (
      <div className="pipeline-detail-error" style={{ maxWidth: '600px', margin: '4rem auto', padding: '1rem' }}>
        <div className="auth-alert-error" role="alert">
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>Unable to Load Pipeline:</strong> {error || 'Pipeline does not exist or has been deleted.'}
          </div>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => fetchPipelineDetails(true)}>
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
          <Link to="/pipelines" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Back to Pipelines
          </Link>
        </div>
      </div>
    );
  }

  const isActive = pipeline.status === 'ACTIVE';
  const isScheduled = Boolean(pipeline.schedule?.enabled);
  const hasTransformations = Boolean(pipeline.transformations?.enabled);

  return (
    <div className="pipeline-detail-page">
      {/* Page Header with Breadcrumbs & Actions */}
      <PageHeader
        title={pipeline.name}
        subtitle={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <span className={`badge ${isActive ? 'badge-success' : 'badge-muted'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="badge badge-info">
              {pipeline.syncMode || 'FULL'}
            </span>
            {pipeline.syncMode === 'INCREMENTAL' && pipeline.cursorField && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Cursor Field: <code>{pipeline.cursorField}</code>
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ID: <code>{pipeline.id}</code>
            </span>
          </div>
        }
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Pipelines', path: '/pipelines' },
          { label: pipeline.name }
        ]}
        actions={
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
            {/* Refresh Button */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchPipelineDetails(true)}
              disabled={isRefreshing || isRunningPipeline}
              title="Refresh details"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'badge-pulse' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Edit Settings Button */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditModalOpen(true)}
              title="Edit pipeline settings"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <Edit3 size={14} />
              <span>Edit</span>
            </button>

            {/* Run Pipeline Button */}
            <button
              type="button"
              className="btn btn-primary"
              id="btn-run-pipeline"
              onClick={handleOpenExecutionModal}
              disabled={isExecutionModalOpen || pipeline?.isRunning}
              title={pipeline?.status !== 'ACTIVE' ? 'Activate pipeline to run' : 'Run pipeline now'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8125rem',
                minWidth: '130px',
                justifyContent: 'center'
              }}
            >
              {pipeline?.isRunning || isExecutionModalOpen ? (
                <>
                  <span className="spinner"></span>
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  <span>Run Pipeline</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Execution Feedback Banner */}
      {lastRunBanner && (
        <div
          className={
            lastRunBanner.type === 'success'
              ? 'detail-action-banner'
              : lastRunBanner.type === 'warning'
              ? 'auth-alert-error'
              : 'auth-alert-error'
          }
          style={{ marginBottom: '1.5rem', animation: 'fadeIn 0.2s ease-in' }}
        >
          <div className="banner-left">
            {lastRunBanner.type === 'success' ? (
              <CheckCircle2 size={24} color="var(--success)" />
            ) : lastRunBanner.type === 'warning' ? (
              <AlertTriangle size={24} color="var(--warning)" />
            ) : (
              <XCircle size={24} color="var(--danger)" />
            )}
            <div>
              <h4 className="banner-title">{lastRunBanner.message}</h4>
              {lastRunBanner.run && (
                <p className="banner-subtitle">
                  Extracted: {formatNumber(lastRunBanner.run.recordsExtracted)} | Transformed:{' '}
                  {formatNumber(lastRunBanner.run.recordsTransformed)} | Loaded:{' '}
                  {formatNumber(lastRunBanner.run.recordsLoaded)} | Duration:{' '}
                  {formatDuration(lastRunBanner.run.startedAt, lastRunBanner.run.completedAt)}
                </p>
              )}
            </div>
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setActiveTab('runs');
                fetchRunHistory(1);
              }}
              style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}
            >
              View Run History
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setLastRunBanner(null)}
              style={{ padding: '0.375rem' }}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation Bar */}
      <div className="detail-tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          id="tab-overview"
          aria-selected={activeTab === 'overview'}
          className={`detail-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Workflow size={16} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-runs"
          aria-selected={activeTab === 'runs'}
          className={`detail-tab-btn ${activeTab === 'runs' ? 'active' : ''}`}
          onClick={() => setActiveTab('runs')}
        >
          <Clock size={16} />
          <span>Run History</span>
          {runsPagination.total > 0 && <span className="tab-badge">{runsPagination.total}</span>}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-schedule"
          aria-selected={activeTab === 'schedule'}
          className={`detail-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={16} />
          <span>Schedule</span>
          <span className={`tab-badge ${isScheduled ? 'badge-primary' : ''}`}>
            {isScheduled ? 'On' : 'Off'}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-transform"
          aria-selected={activeTab === 'transform'}
          className={`detail-tab-btn ${activeTab === 'transform' ? 'active' : ''}`}
          onClick={() => setActiveTab('transform')}
        >
          <Sparkles size={16} />
          <span>Transformation</span>
          {hasTransformations && (
            <span className="tab-badge">
              {pipeline.transformations?.fieldMappings?.length || 0}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW
         ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="overview-tab-content">
          <div className="info-cards-grid">
            {/* Source Details Card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="info-card-title">
                  <Database size={18} color="var(--primary)" />
                  <span>Source Connector</span>
                </div>
                <span className="badge badge-info">
                  {pipeline.source?.type || 'Source'}
                </span>
              </div>
              <div className="info-item-list">
                <div className="info-item-row">
                  <span className="info-item-label">Source Name:</span>
                  <span className="info-item-value" style={{ fontWeight: 600 }}>
                    {pipeline.source?.name || '—'}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Source Type:</span>
                  <span className="info-item-value">{pipeline.source?.type || '—'}</span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Source ID:</span>
                  <span className="info-item-value">
                    <code>{pipeline.sourceId || '—'}</code>
                  </span>
                </div>
                <div className="info-item-row" style={{ marginTop: '0.25rem' }}>
                  <span className="info-item-label">Credential Shield:</span>
                  <span className="info-item-value" style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> Redacted & Protected
                  </span>
                </div>
              </div>
            </div>

            {/* Destination Details Card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="info-card-title">
                  <Server size={18} color="var(--success)" />
                  <span>Destination Target</span>
                </div>
                <span className="badge badge-success">
                  {pipeline.destination?.type || 'Destination'}
                </span>
              </div>
              <div className="info-item-list">
                <div className="info-item-row">
                  <span className="info-item-label">Destination Name:</span>
                  <span className="info-item-value" style={{ fontWeight: 600 }}>
                    {pipeline.destination?.name || '—'}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Destination Type:</span>
                  <span className="info-item-value">{pipeline.destination?.type || '—'}</span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Destination ID:</span>
                  <span className="info-item-value">
                    <code>{pipeline.destinationId || '—'}</code>
                  </span>
                </div>
                <div className="info-item-row" style={{ marginTop: '0.25rem' }}>
                  <span className="info-item-label">URI Masking:</span>
                  <span className="info-item-value" style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> Secrets Masked
                  </span>
                </div>
              </div>
            </div>

            {/* Sync Configuration & Checkpoint Card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="info-card-title">
                  <Layers size={18} color="var(--accent)" />
                  <span>Sync & Checkpoint</span>
                </div>
                <span className={`badge ${pipeline.syncMode === 'INCREMENTAL' ? 'badge-primary' : 'badge-muted'}`}>
                  {pipeline.syncMode || 'FULL'}
                </span>
              </div>
              <div className="info-item-list">
                <div className="info-item-row">
                  <span className="info-item-label">Sync Mode:</span>
                  <span className="info-item-value" style={{ fontWeight: 600 }}>
                    {pipeline.syncMode === 'INCREMENTAL' ? 'Incremental Sync' : 'Full Ingestion'}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Cursor Field:</span>
                  <span className="info-item-value">
                    {pipeline.cursorField ? <code>{pipeline.cursorField}</code> : 'N/A (Full Sync)'}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Current Checkpoint:</span>
                  <span className="info-item-value">
                    {pipeline.cursorValue !== null && pipeline.cursorValue !== undefined ? (
                      <code style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        {String(pipeline.cursorValue)}
                      </code>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>None (Initial Baseline)</span>
                    )}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Last Synced:</span>
                  <span className="info-item-value" title={formatDate(pipeline.lastSyncAt)}>
                    {pipeline.lastSyncAt ? `${formatDate(pipeline.lastSyncAt)} (${formatRelativeTime(pipeline.lastSyncAt)})` : 'Never'}
                  </span>
                </div>
                {pipeline.syncMode === 'INCREMENTAL' && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleResetCursor}
                      disabled={isResettingCursor}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      title="Reset checkpoint to null to re-baseline from beginning"
                    >
                      <RotateCcw size={12} className={isResettingCursor ? 'badge-pulse' : ''} />
                      <span>{isResettingCursor ? 'Resetting...' : 'Reset Checkpoint'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Schedule Summary Card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="info-card-title">
                  <Calendar size={18} color="var(--primary)" />
                  <span>Schedule Summary</span>
                </div>
                <span className={`badge ${isScheduled ? 'badge-info' : 'badge-muted'}`}>
                  {isScheduled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="info-item-list">
                <div className="info-item-row">
                  <span className="info-item-label">Schedule Type:</span>
                  <span className="info-item-value">{pipeline.schedule?.type || 'INTERVAL'}</span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Expression:</span>
                  <span className="info-item-value">
                    <code>{pipeline.schedule?.expression || '1h'}</code>
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Next Execution:</span>
                  <span className="info-item-value" style={{ color: isScheduled ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {isScheduled && pipeline.schedule?.nextRunAt
                      ? `${formatDate(pipeline.schedule.nextRunAt)} (${formatRelativeTime(pipeline.schedule.nextRunAt)})`
                      : 'None'}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Last Execution:</span>
                  <span className="info-item-value">
                    {pipeline.schedule?.lastScheduledRunAt
                      ? formatDate(pipeline.schedule.lastScheduledRunAt)
                      : 'None'}
                  </span>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('schedule')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                  >
                    <span>Configure Schedule</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Transformation Summary Card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="info-card-title">
                  <Sparkles size={18} color="var(--accent)" />
                  <span>Transformations</span>
                </div>
                <span className={`badge ${hasTransformations ? 'badge-primary' : 'badge-muted'}`}>
                  {hasTransformations ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="info-item-list">
                <div className="info-item-row">
                  <span className="info-item-label">Status:</span>
                  <span className="info-item-value" style={{ fontWeight: 600 }}>
                    {hasTransformations ? 'Active (ETL Mappings)' : 'Pass-through (Identity)'}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Unmapped Fields:</span>
                  <span className="info-item-value">
                    {pipeline.transformations?.includeUnmapped !== false ? 'Include in Output' : 'Exclude (Strict)'}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Ingestion Metadata:</span>
                  <span className="info-item-value">
                    {pipeline.transformations?.addMetadata ? 'Injecting Metadata' : 'None'}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Rules Configured:</span>
                  <span className="info-item-value">
                    {pipeline.transformations?.fieldMappings?.length || 0} fields mapped
                  </span>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('transform')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                  >
                    <span>Configure Rules</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Timestamps & Metadata Card */}
            <div className="info-card">
              <div className="info-card-header">
                <div className="info-card-title">
                  <Clock size={18} color="var(--text-muted)" />
                  <span>Lifecycle & Timestamps</span>
                </div>
                <span className="badge badge-muted">Pipeline Info</span>
              </div>
              <div className="info-item-list">
                <div className="info-item-row">
                  <span className="info-item-label">Created At:</span>
                  <span className="info-item-value" title={formatDate(pipeline.createdAt)}>
                    {formatDate(pipeline.createdAt)}
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Last Updated:</span>
                  <span className="info-item-value" title={formatDate(pipeline.updatedAt)}>
                    {formatDate(pipeline.updatedAt)} ({formatRelativeTime(pipeline.updatedAt)})
                  </span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Execution Lock:</span>
                  <span className="info-item-value">
                    {pipeline.isRunning ? (
                      <span className="badge badge-warning badge-pulse" style={{ fontSize: '0.6875rem' }}>
                        LOCKED / RUNNING
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>
                        IDLE
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: RUN HISTORY
         ========================================================================= */}
      {activeTab === 'runs' && (
        <div className="runs-tab-content">
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} color="var(--primary)" />
                  <span>Execution History</span>
                </h3>
                <p className="card-subtitle">
                  Historical run audit scoped to this pipeline with throughput metrics and error logs
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fetchRunHistory(runsPage)}
                disabled={runsLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
              >
                <RefreshCw size={14} className={runsLoading ? 'badge-pulse' : ''} />
                <span>Refresh Runs</span>
              </button>
            </div>

            <RunHistoryTable
              runs={runs}
              loading={runsLoading}
              error={runsError}
              pagination={runsPagination}
              onPageChange={(p) => fetchRunHistory(p, runsLimit)}
              onLimitChange={(lim) => {
                setRunsLimit(lim);
                fetchRunHistory(1, lim);
              }}
              showPipelineColumn={false}
              onRetry={() => fetchRunHistory(runsPage, runsLimit)}
              onSelectRun={(run) => {
                setSelectedRun(run);
                setRunDrawerOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SCHEDULE CONFIGURATION
         ========================================================================= */}
      {activeTab === 'schedule' && (
        <div className="schedule-tab-content" style={{ maxWidth: '800px' }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={18} color="var(--primary)" />
                  <span>Pipeline Schedule</span>
                </h3>
                <p className="card-subtitle">
                  Configure automated interval or cron-based background synchronization
                </p>
              </div>

              {/* One-click Enable/Disable Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{ fontSize: '0.8125rem', color: scheduleEnabled ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {scheduleEnabled ? 'Schedule Enabled' : 'Schedule Disabled'}
                </span>
                <label className="switch" title="Toggle schedule">
                  <input
                    type="checkbox"
                    className="switch-input"
                    checked={scheduleEnabled}
                    onChange={handleToggleScheduleEnable}
                    disabled={isTogglingSchedule}
                  />
                  <span className="switch-track">
                    <span className="switch-thumb"></span>
                  </span>
                </label>
              </div>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {/* Next execution banner */}
              {scheduleEnabled && scheduleData?.nextRunAt && (
                <div
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.8125rem'
                  }}
                >
                  <Clock size={16} color="var(--primary)" />
                  <div>
                    Next execution scheduled for{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {formatDate(scheduleData.nextRunAt)}
                    </strong>{' '}
                    ({formatRelativeTime(scheduleData.nextRunAt)})
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Schedule Type Selection */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                    Schedule Mode
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <div
                      className={`selection-card ${scheduleType === 'INTERVAL' ? 'selected' : ''}`}
                      onClick={() => setScheduleType('INTERVAL')}
                      style={{ cursor: 'pointer', padding: '1rem' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <Clock size={16} color="var(--primary)" />
                        <span>Interval</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                        Run at regular time intervals (e.g. every 15m, 1h, 1d)
                      </p>
                    </div>

                    <div
                      className={`selection-card ${scheduleType === 'CRON' ? 'selected' : ''}`}
                      onClick={() => setScheduleType('CRON')}
                      style={{ cursor: 'pointer', padding: '1rem' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <Calendar size={16} color="var(--accent)" />
                        <span>Cron Expression</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                        Advanced scheduling via standard 5-part cron syntax
                      </p>
                    </div>
                  </div>
                </div>

                {/* Interval Mode Inputs */}
                {scheduleType === 'INTERVAL' && (
                  <div>
                    <label className="form-label" htmlFor="interval-input" style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                      Interval Expression
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      {INTERVAL_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          className={`btn ${scheduleExpr === p.value ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setScheduleExpr(p.value)}
                          style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input
                      id="interval-input"
                      type="text"
                      className="form-control"
                      value={scheduleExpr}
                      onChange={(e) => setScheduleExpr(e.target.value)}
                      placeholder="e.g. 15m, 1h, 6h, 1d"
                      style={{ maxWidth: '300px' }}
                    />
                    <small style={{ display: 'block', marginTop: '0.375rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Format: Number followed by unit: <code>s</code> (seconds), <code>m</code> (minutes), <code>h</code> (hours), <code>d</code> (days).
                    </small>
                  </div>
                )}

                {/* Cron Mode Inputs */}
                {scheduleType === 'CRON' && (
                  <div>
                    <label className="form-label" htmlFor="cron-input" style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                      Cron Expression (5 parts)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setScheduleExpr('*/15 * * * *')}
                        style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}
                      >
                        Every 15 mins (*/15 * * * *)
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setScheduleExpr('0 * * * *')}
                        style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}
                      >
                        Hourly (0 * * * *)
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setScheduleExpr('0 0 * * *')}
                        style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}
                      >
                        Midnight Daily (0 0 * * *)
                      </button>
                    </div>
                    <input
                      id="cron-input"
                      type="text"
                      className="form-control"
                      value={scheduleExpr}
                      onChange={(e) => setScheduleExpr(e.target.value)}
                      placeholder="*/15 * * * *"
                      style={{ maxWidth: '360px', fontFamily: 'monospace' }}
                    />
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      <code>minute (0-59) | hour (0-23) | day of month (1-31) | month (1-12) | day of week (0-7)</code>
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingSchedule}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isSavingSchedule ? (
                      <>
                        <span className="spinner"></span>
                        <span>Saving Schedule...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Save Schedule</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: TRANSFORMATION & FIELD MAPPINGS
         ========================================================================= */}
      {activeTab === 'transform' && (
        <div className="transform-tab-content">
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} color="var(--primary)" />
                  <span>Transformations & Field Mappings</span>
                </h3>
                <p className="card-subtitle">
                  Configure projection, field renaming, data type casting, and PII masking rules
                </p>
              </div>

              {/* Transformations Enable Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{ fontSize: '0.8125rem', color: transformConfig.enabled ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {transformConfig.enabled ? 'Transformations Active' : 'Pass-Through (Disabled)'}
                </span>
                <label className="switch" title="Toggle transformation engine">
                  <input
                    type="checkbox"
                    className="switch-input"
                    checked={transformConfig.enabled}
                    onChange={(e) =>
                      setTransformConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                  />
                  <span className="switch-track">
                    <span className="switch-thumb"></span>
                  </span>
                </label>
              </div>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {/* Configuration Toggles */}
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                  <input
                    type="checkbox"
                    checked={transformConfig.includeUnmapped}
                    onChange={(e) =>
                      setTransformConfig((prev) => ({ ...prev, includeUnmapped: e.target.checked }))
                    }
                  />
                  <span>
                    <strong>Include unmapped fields</strong> (Keep non-mapped source fields in output)
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                  <input
                    type="checkbox"
                    checked={transformConfig.addMetadata}
                    onChange={(e) =>
                      setTransformConfig((prev) => ({ ...prev, addMetadata: e.target.checked }))
                    }
                  />
                  <span>
                    <strong>Inject Ingestion Metadata</strong> (Appends <code>_ingestedAt</code> and <code>_pipelineId</code>)
                  </span>
                </label>
              </div>

              {/* Mappings Table */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Configured Field Mappings ({transformConfig.fieldMappings.length})
                  </h4>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddMappingRow}
                    style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Plus size={14} />
                    <span>Add Field Mapping</span>
                  </button>
                </div>

                {transformConfig.fieldMappings.length === 0 ? (
                  <div
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-app)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-muted)',
                      fontSize: '0.8125rem'
                    }}
                  >
                    No field mappings defined. Source fields will pass through as-is unless projection rules are added.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="mapping-table">
                      <thead>
                        <tr>
                          <th style={{ minWidth: '150px' }}>Source Field</th>
                          <th style={{ minWidth: '150px' }}>Target Field</th>
                          <th style={{ minWidth: '130px' }}>Type Cast</th>
                          <th style={{ minWidth: '160px' }}>Transform Rule</th>
                          <th style={{ minWidth: '130px' }}>Default Value</th>
                          <th style={{ width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transformConfig.fieldMappings.map((mapping, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="source_field (e.g. ssn)"
                                value={mapping.sourceField}
                                onChange={(e) => handleUpdateMappingRow(idx, 'sourceField', e.target.value)}
                                style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="target_field"
                                value={mapping.destinationField}
                                onChange={(e) => handleUpdateMappingRow(idx, 'destinationField', e.target.value)}
                                style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                              />
                            </td>
                            <td>
                              <select
                                className="form-select"
                                value={mapping.dataType || ''}
                                onChange={(e) => handleUpdateMappingRow(idx, 'dataType', e.target.value || null)}
                                style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                              >
                                <option value="">As-is (preserve)</option>
                                {DATA_TYPES.map((dt) => (
                                  <option key={dt} value={dt}>
                                    {dt}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select"
                                value={mapping.transformRule || 'NONE'}
                                onChange={(e) => handleUpdateMappingRow(idx, 'transformRule', e.target.value)}
                                style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                              >
                                {TRANSFORM_RULES.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="optional"
                                value={mapping.defaultValue || ''}
                                onChange={(e) => handleUpdateMappingRow(idx, 'defaultValue', e.target.value)}
                                style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleRemoveMappingRow(idx)}
                                title="Remove row"
                                style={{ padding: '0.375rem', color: 'var(--danger)', height: '28px', width: '28px' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePreviewTransformations}
                  disabled={isPreviewing}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
                >
                  <Eye size={14} />
                  <span>{isPreviewing ? 'Simulating...' : 'Preview in-memory'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveTransformations}
                  disabled={isSavingTransform}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}
                >
                  {isSavingTransform ? (
                    <>
                      <span className="spinner"></span>
                      <span>Saving Rules...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Save Transformations</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Non-destructive in-memory preview display */}
          {previewResult && (
            <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--primary)' }}>
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Eye size={18} color="var(--primary)" />
                  <h4 className="card-title" style={{ margin: 0 }}>
                    In-Memory Preview Result (Zero Destination Writes)
                  </h4>
                </div>
                <span className="badge badge-primary">
                  {previewResult.transformedCount} records transformed
                </span>
              </div>
              <div style={{ padding: '1rem', overflowX: 'auto' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Sample transformed record:
                </p>
                <pre
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    overflowX: 'auto'
                  }}
                >
                  {JSON.stringify(previewResult.sampleTransformed?.[0] || previewResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          RUN DETAILS DRAWER / MODAL
         ========================================================================= */}
      {runDrawerOpen && selectedRun && (
        <div
          className="drawer-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRunDrawerOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="drawer-panel">
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Execution Details</h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRunDrawerOpen(false)}
                style={{ padding: '0.25rem' }}
                title="Close drawer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="drawer-body">
              {/* Status Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor:
                    selectedRun.status === 'SUCCESS'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : selectedRun.status === 'FAILED'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${
                    selectedRun.status === 'SUCCESS'
                      ? 'var(--success)'
                      : selectedRun.status === 'FAILED'
                      ? 'var(--danger)'
                      : 'var(--warning)'
                  }`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedRun.status === 'SUCCESS' ? (
                    <CheckCircle2 size={18} color="var(--success)" />
                  ) : selectedRun.status === 'FAILED' ? (
                    <XCircle size={18} color="var(--danger)" />
                  ) : (
                    <Clock size={18} color="var(--warning)" />
                  )}
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{selectedRun.status}</span>
                </div>
                <span className="badge badge-muted">{selectedRun.triggeredBy || 'MANUAL'}</span>
              </div>

              {/* Error Message if Failed */}
              {selectedRun.errorMessage && (
                <div className="auth-alert-error" role="alert" style={{ fontSize: '0.8125rem' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Execution Diagnostic:</strong>
                    <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {selectedRun.errorMessage}
                    </div>
                  </div>
                </div>
              )}

              {/* Throughput Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>EXTRACTED</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {formatNumber(selectedRun.recordsExtracted)}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>TRANSFORMED</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {formatNumber(selectedRun.recordsTransformed)}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>LOADED</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>
                    {formatNumber(selectedRun.recordsLoaded)}
                  </div>
                </div>
              </div>

              {/* Metadata Details List */}
              <div className="info-item-list" style={{ marginTop: '0.5rem' }}>
                <div className="info-item-row">
                  <span className="info-item-label">Run ID:</span>
                  <span className="info-item-value"><code>{selectedRun.id}</code></span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Sync Mode:</span>
                  <span className="info-item-value">{selectedRun.syncMode || 'FULL'}</span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Duration:</span>
                  <span className="info-item-value">{formatDuration(selectedRun.startedAt, selectedRun.completedAt)}</span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Started At:</span>
                  <span className="info-item-value">{formatDate(selectedRun.startedAt)}</span>
                </div>
                <div className="info-item-row">
                  <span className="info-item-label">Completed At:</span>
                  <span className="info-item-value">{formatDate(selectedRun.completedAt)}</span>
                </div>
                {selectedRun.cursorField && (
                  <div className="info-item-row">
                    <span className="info-item-label">Cursor Field:</span>
                    <span className="info-item-value"><code>{selectedRun.cursorField}</code></span>
                  </div>
                )}
                {selectedRun.cursorValueBefore !== null && selectedRun.cursorValueBefore !== undefined && (
                  <div className="info-item-row">
                    <span className="info-item-label">Cursor Before:</span>
                    <span className="info-item-value"><code>{String(selectedRun.cursorValueBefore)}</code></span>
                  </div>
                )}
                {selectedRun.cursorValueAfter !== null && selectedRun.cursorValueAfter !== undefined && (
                  <div className="info-item-row">
                    <span className="info-item-label">Cursor After:</span>
                    <span className="info-item-value"><code>{String(selectedRun.cursorValueAfter)}</code></span>
                  </div>
                )}
              </div>

              {/* Security Shield Notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 'auto'
                }}
              >
                <ShieldCheck size={16} color="var(--success)" style={{ flexShrink: 0 }} />
                <span>All sensitive connection parameters, database URIs, and authentication tokens are masked.</span>
              </div>
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRunDrawerOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT PIPELINE SETTINGS MODAL
         ========================================================================= */}
      {isEditModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingEdit) setIsEditModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pipeline-modal-title"
        >
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 id="edit-pipeline-modal-title" className="card-title">Edit Pipeline Settings</h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSavingEdit}
                style={{ padding: '0.25rem' }}
                aria-label="Close edit pipeline dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label" htmlFor="edit-name" style={{ fontWeight: 600 }}>
                    Pipeline Name
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    className="form-control"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="edit-status" style={{ fontWeight: 600 }}>
                    Status
                  </label>
                  <select
                    id="edit-status"
                    className="form-select"
                    value={editForm.status}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" htmlFor="edit-syncMode" style={{ fontWeight: 600 }}>
                    Sync Mode
                  </label>
                  <select
                    id="edit-syncMode"
                    className="form-select"
                    value={editForm.syncMode}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, syncMode: e.target.value }))}
                  >
                    <option value="FULL">FULL (Full reload)</option>
                    <option value="INCREMENTAL">INCREMENTAL (Cursor based)</option>
                  </select>
                </div>

                {editForm.syncMode === 'INCREMENTAL' && (
                  <div>
                    <label className="form-label" htmlFor="edit-cursorField" style={{ fontWeight: 600 }}>
                      Cursor Field
                    </label>
                    <input
                      id="edit-cursorField"
                      type="text"
                      className="form-control"
                      placeholder="e.g. id or updatedAt"
                      value={editForm.cursorField}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, cursorField: e.target.value }))}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSavingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingEdit}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isSavingEdit ? (
                    <>
                      <span className="spinner"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Interactive Execution Modal */}
      <ExecutionModal
        isOpen={isExecutionModalOpen}
        onClose={() => {
          setIsExecutionModalOpen(false);
          fetchPipelineDetails();
          if (activeTab === 'runs') {
            fetchRunHistory(1);
          }
        }}
        pipeline={pipeline}
        onComplete={handleExecutionModalComplete}
      />
    </div>
  );
}

export default PipelineDetailPage;
