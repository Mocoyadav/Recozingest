import React from 'react';
import {
  Workflow,
  CalendarClock,
  Play,
  Activity,
  CheckCircle,
  Clock,
  Code
} from 'lucide-react';

const INTERVAL_PRESETS = ['15 mins', '30 mins', '1 hour', '6 hours', '12 hours', '1 day'];

export function AutomationSection() {
  return (
    <section className="landing-section" aria-labelledby="automation-heading">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-section-tag">Orchestration</span>
          <h2 id="automation-heading" className="landing-section-title">
            Keep Your Pipelines Running Automatically
          </h2>
          <p className="landing-section-subtitle">
            Configure reliable recurring pipeline executions using flexible interval timers or industry-standard cron syntax.
          </p>
        </div>

        <div className="landing-automation-container">
          {/* Left: Execution Flow Visual */}
          <div className="landing-automation-info">
            <h3 style={{ fontFamily: 'var(--landing-font-heading)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--landing-text-primary)' }}>
              Automated Lifecycle
            </h3>
            <p style={{ color: 'var(--landing-text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>
              Set up your pipeline once and let the orchestrator handle recurring syncs, cursor tracking, and data dispatch without manual intervention.
            </p>

            <div className="landing-automation-flow-steps">
              <div className="landing-automation-step-row">
                <div className="landing-automation-step-icon">
                  <Workflow size={18} />
                </div>
                <div className="landing-automation-step-text">
                  <strong>1. Define Pipeline</strong>
                  <span>Bind your source connector, target destination, and field mappings.</span>
                </div>
              </div>

              <div className="landing-automation-step-row">
                <div className="landing-automation-step-icon">
                  <CalendarClock size={18} />
                </div>
                <div className="landing-automation-step-text">
                  <strong>2. Set Schedule</strong>
                  <span>Choose predefined interval cadences or input custom cron schedules.</span>
                </div>
              </div>

              <div className="landing-automation-step-row">
                <div className="landing-automation-step-icon">
                  <Play size={18} />
                </div>
                <div className="landing-automation-step-text">
                  <strong>3. Automatic Run</strong>
                  <span>Engine executes in the background, updating checkpoints and sync cursors.</span>
                </div>
              </div>

              <div className="landing-automation-step-row">
                <div className="landing-automation-step-icon">
                  <Activity size={18} />
                </div>
                <div className="landing-automation-step-text">
                  <strong>4. Monitor Result</strong>
                  <span>Inspect run duration, record telemetry, and execution logs in real time.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Supported Scheduling Modes Card */}
          <div className="landing-automation-card">
            {/* Interval Mode Box */}
            <div className="landing-schedule-mode-box">
              <div className="landing-schedule-mode-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} color="var(--landing-primary)" />
                  <span>Interval Scheduling</span>
                </div>
                <span className="landing-badge-pill" style={{ margin: 0, padding: '0.15rem 0.5rem', fontSize: '0.6875rem' }}>
                  Supported
                </span>
              </div>
              <p className="landing-schedule-mode-desc">
                Trigger sync cycles at predictable frequencies with built-in cadence presets:
              </p>
              <div className="landing-interval-pills">
                {INTERVAL_PRESETS.map((preset, idx) => (
                  <span
                    key={preset}
                    className={`landing-interval-pill ${idx === 2 ? 'active' : ''}`}
                  >
                    {preset}
                  </span>
                ))}
              </div>
            </div>

            {/* Cron Mode Box */}
            <div className="landing-schedule-mode-box">
              <div className="landing-schedule-mode-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Code size={18} color="var(--landing-accent)" />
                  <span>Cron Expressions</span>
                </div>
                <span className="landing-badge-pill" style={{ margin: 0, padding: '0.15rem 0.5rem', fontSize: '0.6875rem' }}>
                  Supported
                </span>
              </div>
              <p className="landing-schedule-mode-desc">
                Fine-tune execution down to exact minute, hour, day, and weekday schedules:
              </p>
              <div className="landing-cron-preview">
                <span style={{ color: '#94a3b8' }}>Schedule:</span>
                <span>0 */2 * * *</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#a7f3d0' }}>
                  (Every 2 hours)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--landing-text-muted)' }}>
              <CheckCircle size={15} color="var(--landing-success)" />
              <span>Includes toggle control to pause or resume automated runs at any time.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AutomationSection;
