import React from 'react';
import { Shuffle, ArrowRight, ShieldCheck, Check, Sparkles } from 'lucide-react';

const RAW_DATA_JSON = `{
  "user_id": 1042,
  "full_name": "jane doe",
  "email": "jane@example.com",
  "tax_id": "987-65-4321",
  "api_token": "sk_live_9a8b7c6d5e",
  "is_active": "true"
}`;

const STRUCTURED_DATA_JSON = `{
  "userId": 1042,
  "fullName": "JANE DOE",
  "email": "jane@example.com",
  "taxId": "***-**-4321",
  "tokenHash": "e3b0c44298fc1c149af...",
  "isActive": true,
  "_ingestedAt": "2026-10-01T22:56:00Z",
  "_pipelineId": "pip_98a7b6c5"
}`;

const TRANSFORMATION_RULES = [
  { field: 'full_name → fullName', rule: 'UPPERCASE', desc: 'Convert string to uppercase' },
  { field: 'tax_id → taxId', rule: 'MASK_REDACT', desc: 'Redact sensitive identifier' },
  { field: 'api_token → tokenHash', rule: 'MASK_HASH (SHA-256)', desc: 'One-way cryptographic hash' },
  { field: 'is_active → isActive', rule: 'TYPE CAST (BOOLEAN)', desc: 'String to boolean conversion' },
  { field: 'Metadata Injection', rule: '_ingestedAt & _pipelineId', desc: 'Audit trail timestamps' }
];

export function TransformationSection() {
  return (
    <section className="landing-section landing-section-muted" aria-labelledby="transformation-heading">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-section-tag">In-Flight Transformation</span>
          <h2 id="transformation-heading" className="landing-section-title">
            Shape Your Data Before It Arrives
          </h2>
          <p className="landing-section-subtitle">
            Prepare your data as part of the pipeline so information reaches its destination in the structure your workflow needs.
          </p>
        </div>

        {/* Workbench: Raw Data -> Transform Rules -> Clean Data */}
        <div className="landing-transform-workbench">
          <div className="landing-transform-grid">
            {/* Raw Data Panel */}
            <div className="landing-code-panel">
              <div className="landing-code-header">
                <span>Raw Source Data</span>
                <span style={{ color: '#fbbf24' }}>JSON Payload</span>
              </div>
              <pre className="landing-code-body">{RAW_DATA_JSON}</pre>
            </div>

            {/* Transform Rules Panel */}
            <div className="landing-rules-panel">
              <div className="landing-rules-header">
                <span className="landing-rules-title">
                  <Shuffle size={16} color="var(--landing-primary)" />
                  <span>Pipeline Mappings</span>
                </span>
                <span className="landing-badge-pill" style={{ margin: 0, padding: '0.15rem 0.5rem', fontSize: '0.6875rem' }}>
                  Live Engine
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {TRANSFORMATION_RULES.map((rule, idx) => (
                  <div key={idx} className="landing-rule-pill">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--landing-text-primary)' }}>{rule.field}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--landing-text-muted)' }}>{rule.desc}</span>
                    </div>
                    <span className="landing-rule-pill-tag">{rule.rule}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Clean Data Panel */}
            <div className="landing-code-panel" style={{ border: '1px solid rgba(16, 185, 129, 0.4)' }}>
              <div className="landing-code-header" style={{ background: '#064e3b' }}>
                <span style={{ color: '#a7f3d0' }}>Clean / Structured Data</span>
                <span style={{ color: '#34d399' }}>Destination Schema</span>
              </div>
              <pre className="landing-code-body" style={{ color: '#d1fae5' }}>{STRUCTURED_DATA_JSON}</pre>
            </div>
          </div>

          {/* Supported capabilities breakdown */}
          <div className="landing-transform-features-list">
            <div className="landing-transform-feature-item">
              <div className="landing-transform-feature-bullet">
                <Check size={14} />
              </div>
              <div>
                <h4 className="landing-transform-feature-title">Field Mapping & Casts</h4>
                <p className="landing-transform-feature-desc">Map fields and cast types to STRING, NUMBER, BOOLEAN, DATE, or JSON.</p>
              </div>
            </div>

            <div className="landing-transform-feature-item">
              <div className="landing-transform-feature-bullet">
                <Check size={14} />
              </div>
              <div>
                <h4 className="landing-transform-feature-title">String Formatting</h4>
                <p className="landing-transform-feature-desc">Apply UPPERCASE, lowercase, and whitespace trimming rules automatically.</p>
              </div>
            </div>

            <div className="landing-transform-feature-item">
              <div className="landing-transform-feature-bullet">
                <Check size={14} />
              </div>
              <div>
                <h4 className="landing-transform-feature-title">Privacy Redaction</h4>
                <p className="landing-transform-feature-desc">Mask sensitive fields or generate cryptographic SHA-256 hashes.</p>
              </div>
            </div>

            <div className="landing-transform-feature-item">
              <div className="landing-transform-feature-bullet">
                <Check size={14} />
              </div>
              <div>
                <h4 className="landing-transform-feature-title">Metadata Tracking</h4>
                <p className="landing-transform-feature-desc">Automatically append ingestion timestamps and pipeline IDs to every record.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TransformationSection;
