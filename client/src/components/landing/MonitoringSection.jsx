import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  AlertCircle,
  TrendingUp,
  FileCheck
} from 'lucide-react';

export function MonitoringSection() {
  return (
    <section className="landing-section landing-section-muted" aria-labelledby="monitoring-heading">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-section-tag">Observability</span>
          <h2 id="monitoring-heading" className="landing-section-title">
            Know What Happened in Every Run
          </h2>
          <p className="landing-section-subtitle">
            Track execution lifecycle, throughput metrics, incremental checkpoints, and diagnostics across all pipeline runs.
          </p>
        </div>

        <div className="landing-monitoring-container">
          {/* Left: Explanatory features */}
          <div className="landing-monitoring-info">
            <h3 style={{ fontFamily: 'var(--landing-font-heading)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--landing-text-primary)' }}>
              Comprehensive Run Telemetry
            </h3>
            <p style={{ color: 'var(--landing-text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>
              Every time a pipeline executes, RicozIngest logs full execution metrics from source extraction to destination loading.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ marginTop: '3px', color: 'var(--landing-success)' }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--landing-text-primary)' }}>
                    Exact Record Accounting
                  </strong>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--landing-text-secondary)' }}>
                    Verify how many records were extracted, transformed, and loaded in each phase.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ marginTop: '3px', color: 'var(--landing-primary)' }}>
                  <Clock size={18} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--landing-text-primary)' }}>
                    Execution Duration & Timing
                  </strong>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--landing-text-secondary)' }}>
                    Track pipeline runtime in milliseconds to detect bottlenecks before they impact operations.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ marginTop: '3px', color: 'var(--landing-accent)' }}>
                  <Database size={18} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--landing-text-primary)' }}>
                    Cursor & Checkpoint Inspection
                  </strong>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--landing-text-secondary)' }}>
                    Inspect the current high-water mark for incremental syncs with zero duplicate ingestions.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ marginTop: '3px', color: '#8b5cf6' }}>
                  <FileCheck size={18} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--landing-text-primary)' }}>
                    Sanitized Error Diagnostics
                  </strong>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--landing-text-secondary)' }}>
                    Access actionable error traces stripped of sensitive passwords or database credentials.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Dashboard-style Visual Card */}
          <div className="landing-monitoring-card" aria-label="Sample Pipeline Run Telemetry Card">
            <div className="landing-monitoring-header">
              <div className="landing-monitoring-pipeline-meta">
                <span className="landing-monitoring-pipeline-name">
                  Orders Extraction Pipeline
                </span>
                <span className="landing-monitoring-pipeline-id">
                  Run ID: run_8f91c3 • Trigger: SCHEDULED
                </span>
              </div>
              <div className="landing-pipeline-status">
                <CheckCircle2 size={14} />
                <span>SUCCESS</span>
              </div>
            </div>

            {/* Metrics Counters */}
            <div className="landing-metrics-grid">
              <div className="landing-metric-box">
                <div className="landing-metric-val">100</div>
                <div className="landing-metric-label">Extracted</div>
              </div>
              <div className="landing-metric-box">
                <div className="landing-metric-val">100</div>
                <div className="landing-metric-label">Transformed</div>
              </div>
              <div className="landing-metric-box">
                <div className="landing-metric-val">100</div>
                <div className="landing-metric-label">Loaded</div>
              </div>
            </div>

            {/* Telemetry Detail Rows */}
            <div className="landing-telemetry-rows">
              <div className="landing-telemetry-row">
                <span className="landing-telemetry-key">Execution Duration</span>
                <span className="landing-telemetry-val">1.24s</span>
              </div>
              <div className="landing-telemetry-row">
                <span className="landing-telemetry-key">Sync Mode</span>
                <span className="landing-telemetry-val">Incremental (Cursor: updated_at)</span>
              </div>
              <div className="landing-telemetry-row">
                <span className="landing-telemetry-key">Source</span>
                <span className="landing-telemetry-val">REST API (GET /api/v1/orders)</span>
              </div>
              <div className="landing-telemetry-row">
                <span className="landing-telemetry-key">Destination</span>
                <span className="landing-telemetry-val">MongoDB (collection: orders_v2)</span>
              </div>
              <div className="landing-telemetry-row">
                <span className="landing-telemetry-key">Diagnostics</span>
                <span className="landing-telemetry-val" style={{ color: 'var(--landing-success)' }}>
                  0 Errors • Checkpoint verified
                </span>
              </div>
            </div>

            <div className="landing-preview-disclaimer">
              Product UI Preview — Illustrative Telemetry Dashboard
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MonitoringSection;
