import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Workflow,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Database,
  Server,
  Layers,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  FileText,
  Globe,
  Sliders
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import sourceService from '../../services/source.service.js';
import destinationService from '../../services/destination.service.js';
import pipelineService from '../../services/pipeline.service.js';
import { useToast } from '../../hooks/useToast.js';

export function PipelineCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');

  // Step 2: Sync Mode
  const [syncMode, setSyncMode] = useState('FULL');
  const [cursorField, setCursorField] = useState('id');

  // Step 3: Schedule & Transformation
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleType, setScheduleType] = useState('INTERVAL');
  const [scheduleExpression, setScheduleExpression] = useState('1h');
  const [transformationsEnabled, setTransformationsEnabled] = useState(false);

  // Available Resources
  const [sources, setSources] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [resourceError, setResourceError] = useState(null);

  // Form Submission
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load user's sources and destinations
  useEffect(() => {
    async function loadResources() {
      setLoadingResources(true);
      setResourceError(null);
      try {
        const [srcRes, destRes] = await Promise.all([
          sourceService.getSources(),
          destinationService.getDestinations()
        ]);
        setSources(srcRes.sources || []);
        setDestinations(destRes.destinations || []);

        if (srcRes.sources?.length > 0) {
          setSourceId(srcRes.sources[0].id);
        }
        if (destRes.destinations?.length > 0) {
          setDestinationId(destRes.destinations[0].id);
        }
      } catch (err) {
        setResourceError(err.message || 'Failed to load sources or destinations.');
      } finally {
        setLoadingResources(false);
      }
    }
    loadResources();
  }, []);

  // Validation per step
  const validateStep1 = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Pipeline name is required';
    if (!sourceId) errs.sourceId = 'Please select a data source';
    if (!destinationId) errs.destinationId = 'Please select a destination target';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (syncMode === 'INCREMENTAL') {
      if (!cursorField.trim()) {
        errs.cursorField = 'Cursor field is required for incremental sync';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    const errs = {};
    if (scheduleEnabled) {
      if (!scheduleExpression.trim()) {
        errs.scheduleExpression = 'Schedule expression cannot be empty';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handleBack = () => {
    setErrors({});
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    setIsSubmitting(true);
    try {
      // 1. Create pipeline with basic + syncMode + transformations
      const createPayload = {
        name: name.trim(),
        sourceId,
        destinationId,
        syncMode,
        cursorField: syncMode === 'INCREMENTAL' ? cursorField.trim() : null,
        status: 'ACTIVE',
        transformations: {
          enabled: Boolean(transformationsEnabled),
          includeUnmapped: true,
          addMetadata: false,
          fieldMappings: []
        }
      };

      const result = await pipelineService.createPipeline(createPayload);
      const createdPipeline = result.pipeline;

      // 2. If schedule was enabled, apply initial schedule configuration
      if (scheduleEnabled && createdPipeline && createdPipeline.id) {
        try {
          await pipelineService.updateSchedule(createdPipeline.id, {
            type: scheduleType,
            expression: scheduleExpression.trim(),
            enabled: true
          });
        } catch (scheduleErr) {
          toast.warning(`Pipeline created, but schedule configuration failed: ${scheduleErr.message}`);
        }
      }

      toast.success(`Pipeline "${createdPipeline.name}" created successfully!`);
      navigate('/pipelines');
    } catch (err) {
      toast.error(err.message || 'Failed to create pipeline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSource = sources.find((s) => s.id === sourceId);
  const selectedDestination = destinations.find((d) => d.id === destinationId);

  return (
    <div className="pipeline-create-page">
      <PageHeader
        title="Create Pipeline"
        subtitle="Set up an automated ingestion flow connecting your data source to destination"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Pipelines', path: '/pipelines' },
          { label: 'New Pipeline' }
        ]}
      />

      <div className="wizard-card">
        {/* Step Indicator Header */}
        <div className="wizard-steps-header">
          {/* Step 1 Indicator */}
          <div className={`wizard-step-indicator ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>
            <div className={`wizard-step-circle ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>
              {currentStep > 1 ? <Check size={16} /> : '1'}
            </div>
            <div className="wizard-step-label">
              <span className="wizard-step-title">Basics</span>
              <span className="wizard-step-desc">Name & Endpoints</span>
            </div>
          </div>

          <div className={`wizard-step-divider ${currentStep > 1 ? 'completed' : ''}`} />

          {/* Step 2 Indicator */}
          <div className={`wizard-step-indicator ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>
            <div className={`wizard-step-circle ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>
              {currentStep > 2 ? <Check size={16} /> : '2'}
            </div>
            <div className="wizard-step-label">
              <span className="wizard-step-title">Sync Mode</span>
              <span className="wizard-step-desc">Full or Incremental</span>
            </div>
          </div>

          <div className={`wizard-step-divider ${currentStep > 2 ? 'completed' : ''}`} />

          {/* Step 3 Indicator */}
          <div className={`wizard-step-indicator ${currentStep === 3 ? 'active' : ''}`}>
            <div className={`wizard-step-circle ${currentStep === 3 ? 'active' : ''}`}>
              3
            </div>
            <div className="wizard-step-label">
              <span className="wizard-step-title">Settings</span>
              <span className="wizard-step-desc">Schedule & Transforms</span>
            </div>
          </div>
        </div>

        {/* Wizard Step Body */}
        <div className="wizard-body">
          {/* STEP 1: BASICS */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Step 1: Pipeline Basics
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Name your ingestion pipeline and link the origin source connector to the target storage destination.
                </p>
              </div>

              {resourceError && (
                <div className="auth-alert-error" role="alert">
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{resourceError}</span>
                </div>
              )}

              {/* Pipeline Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="pipeline-name">
                  Pipeline Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="pipeline-name"
                  type="text"
                  className={`form-control ${errors.name ? 'has-error' : ''}`}
                  placeholder="e.g., Stripe Payments to Data Lake Sync"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                  }}
                  autoFocus
                />
                {errors.name && <span className="auth-input-error">{errors.name}</span>}
              </div>

              {/* Source Selection */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label className="form-label">
                    Select Data Source <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <Link to="/sources" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none' }}>
                    + New Source
                  </Link>
                </div>

                {loadingResources ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <span className="spinner"></span>
                  </div>
                ) : sources.length === 0 ? (
                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px dashed var(--border-default)',
                      textAlign: 'center'
                    }}
                  >
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      No data sources found in your account.
                    </p>
                    <Link to="/sources" className="btn btn-secondary" style={{ display: 'inline-flex', fontSize: '0.75rem' }}>
                      Create a Source First
                    </Link>
                  </div>
                ) : (
                  <div className="selection-grid">
                    {sources.map((s) => {
                      const isSelected = sourceId === s.id;
                      return (
                        <div
                          key={s.id}
                          className={`selection-card ${isSelected ? 'selected' : ''}`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSourceId(s.id);
                            if (errors.sourceId) setErrors((prev) => ({ ...prev, sourceId: null }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSourceId(s.id);
                              if (errors.sourceId) setErrors((prev) => ({ ...prev, sourceId: null }));
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                              {s.name}
                            </span>
                            <span className="badge badge-info" style={{ fontSize: '0.625rem' }}>
                              {s.type}
                            </span>
                          </div>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              color: 'var(--text-muted)',
                              wordBreak: 'break-all'
                            }}
                          >
                            {s.config?.url || `${s.config?.host || 'host'}:${s.config?.port || ''}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors.sourceId && <span className="auth-input-error">{errors.sourceId}</span>}
              </div>

              {/* Destination Selection */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label className="form-label">
                    Select Destination Target <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <Link to="/destinations" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none' }}>
                    + New Destination
                  </Link>
                </div>

                {loadingResources ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <span className="spinner"></span>
                  </div>
                ) : destinations.length === 0 ? (
                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px dashed var(--border-default)',
                      textAlign: 'center'
                    }}
                  >
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      No destinations found in your account.
                    </p>
                    <Link to="/destinations" className="btn btn-secondary" style={{ display: 'inline-flex', fontSize: '0.75rem' }}>
                      Create a Destination First
                    </Link>
                  </div>
                ) : (
                  <div className="selection-grid">
                    {destinations.map((d) => {
                      const isSelected = destinationId === d.id;
                      return (
                        <div
                          key={d.id}
                          className={`selection-card ${isSelected ? 'selected' : ''}`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setDestinationId(d.id);
                            if (errors.destinationId) setErrors((prev) => ({ ...prev, destinationId: null }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setDestinationId(d.id);
                              if (errors.destinationId) setErrors((prev) => ({ ...prev, destinationId: null }));
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                              {d.name}
                            </span>
                            <span className="badge badge-success" style={{ fontSize: '0.625rem' }}>
                              {d.type}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            {d.config?.database ? `DB: ${d.config.database}` : 'Target Storage'} &bull; {d.config?.collection ? `Col: ${d.config.collection}` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors.destinationId && <span className="auth-input-error">{errors.destinationId}</span>}
              </div>
            </div>
          )}

          {/* STEP 2: SYNC MODE */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Step 2: Ingestion Synchronization Strategy
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Choose how data will be fetched on each pipeline run.
                </p>
              </div>

              {/* Sync Mode Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div
                  className={`selection-card ${syncMode === 'FULL' ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={syncMode === 'FULL'}
                  onClick={() => setSyncMode('FULL')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSyncMode('FULL');
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={20} color="var(--primary)" />
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                      FULL (Full Snapshot)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Re-extracts the complete dataset from the source and loads it into the destination on every execution. Ideal for lookup tables, small catalogs, or stateless feeds.
                  </p>
                </div>

                <div
                  className={`selection-card ${syncMode === 'INCREMENTAL' ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={syncMode === 'INCREMENTAL'}
                  onClick={() => setSyncMode('INCREMENTAL')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSyncMode('INCREMENTAL');
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sliders size={20} color="var(--accent)" />
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                      INCREMENTAL (Delta Tracking)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Tracks a monotonic checkpoint cursor (e.g. integer ID or timestamp) across executions. Only extracts records newer than the last committed checkpoint.
                  </p>
                </div>
              </div>

              {/* Cursor Field Input for INCREMENTAL */}
              {syncMode === 'INCREMENTAL' && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <label className="form-label" htmlFor="cursor-field">
                    Cursor Field <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="cursor-field"
                    type="text"
                    className={`form-control ${errors.cursorField ? 'has-error' : ''}`}
                    placeholder="e.g., id, updated_at, timestamp"
                    value={cursorField}
                    onChange={(e) => {
                      setCursorField(e.target.value);
                      if (errors.cursorField) setErrors((prev) => ({ ...prev, cursorField: null }));
                    }}
                  />
                  {errors.cursorField && (
                    <span className="auth-input-error">{errors.cursorField}</span>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    The cursor field must exist on each source record and monotonically increase with newly inserted or updated rows.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: SCHEDULE & TRANSFORMATION */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Step 3: Initial Schedule & Transformation
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Optionally automate pipeline runs with cron/interval triggers and enable transformation capabilities.
                </p>
              </div>

              {/* Schedule Configuration Card */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-default)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <Calendar size={18} color="var(--primary)" />
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        Automated Schedule
                      </span>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Run this pipeline periodically in the background
                      </p>
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      className="switch-input"
                      checked={scheduleEnabled}
                      onChange={(e) => setScheduleEnabled(e.target.checked)}
                    />
                    <span className="switch-track">
                      <span className="switch-thumb"></span>
                    </span>
                  </label>
                </div>

                {scheduleEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label">Type</label>
                        <select
                          className="form-select"
                          value={scheduleType}
                          onChange={(e) => setScheduleType(e.target.value)}
                        >
                          <option value="INTERVAL">INTERVAL</option>
                          <option value="CRON">CRON</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Expression ({scheduleType === 'INTERVAL' ? 'e.g. 15m, 1h, 1d' : '5-part standard cron'})
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder={scheduleType === 'INTERVAL' ? '1h' : '*/10 * * * *'}
                          value={scheduleExpression}
                          onChange={(e) => setScheduleExpression(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Transformation Configuration Card */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-default)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <Sparkles size={18} color="var(--accent)" />
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        Data Transformations
                      </span>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Enable schema mapping, data type casting, and PII masking
                      </p>
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      className="switch-input"
                      checked={transformationsEnabled}
                      onChange={(e) => setTransformationsEnabled(e.target.checked)}
                    />
                    <span className="switch-track">
                      <span className="switch-thumb"></span>
                    </span>
                  </label>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Detailed field mapping rules (renaming, UPPERCASE, TRIM, MASK_HASH, MASK_REDACT) and non-destructive live previews can be configured in the Pipeline Details Hub after creation.
                </p>
              </div>

              {/* Review Summary */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-light)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)' }}>
                  Summary Preview
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Pipeline:</span>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Source:</span>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedSource?.name || 'Selected'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Destination:</span>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedDestination?.name || 'Selected'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Mode:</span>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {syncMode} {syncMode === 'INCREMENTAL' ? `(${cursorField})` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="wizard-footer">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
                disabled={isSubmitting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/pipelines')}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            {currentStep < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
                disabled={loadingResources || (currentStep === 1 && (sources.length === 0 || destinations.length === 0))}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span>Continue</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
                id="btn-create-pipeline-submit"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    <span>Creating Pipeline...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Create Pipeline</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PipelineCreatePage;
