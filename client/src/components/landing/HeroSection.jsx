import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Globe,
  Database,
  FileText,
  Server,
  Shuffle,
  Shield,
  Activity,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export function HeroSection() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="landing-hero" aria-labelledby="hero-heading">
      <div className="landing-container">
        {/* Hero Copy & CTA */}
        <div className="landing-hero-content">
          <div className="landing-badge-pill">
            <span className="landing-badge-pulse" aria-hidden="true"></span>
            <span>Automated B2B Data Pipelines & Ingestion</span>
          </div>

          <h1 id="hero-heading" className="landing-hero-title">
            Connect Your Data. Transform It. Deliver It.
          </h1>

          <p className="landing-hero-subtitle">
            RicozIngest helps businesses connect data sources, transform information, automate pipelines, and deliver data to the destinations they need.
          </p>

          <div className="landing-hero-ctas">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="landing-btn landing-btn-primary landing-btn-lg"
                id="hero-cta-dashboard"
              >
                <span>Open Dashboard</span>
                <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="landing-btn landing-btn-primary landing-btn-lg"
                  id="hero-cta-get-started"
                >
                  <span>Get Started</span>
                  <ArrowRight size={18} />
                </Link>
                <Link
                  to="/login"
                  className="landing-btn landing-btn-outline landing-btn-lg"
                  id="hero-cta-login"
                >
                  <span>Login</span>
                </Link>
              </>
            )}
          </div>

          <p className="landing-hero-trust">
            <CheckCircle2 size={16} color="var(--landing-success)" />
            <span>Built to simplify modern data workflows — from APIs and databases to file storage.</span>
          </p>
        </div>

        {/* Hero Visual: SOURCE -> TRANSFORM -> DESTINATION */}
        <div className="landing-hero-visual-card" aria-label="Pipeline Architecture Visualization">
          <div className="landing-pipeline-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--landing-primary)'
                }}
              ></div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--landing-text-primary)' }}>
                Pipeline Flow Architecture
              </span>
            </div>
            <div className="landing-pipeline-status">
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--landing-success)'
                }}
              ></span>
              <span>Automated Engine Active</span>
            </div>
          </div>

          <div className="landing-pipeline-flow">
            {/* 1. SOURCE COLUMN */}
            <div className="landing-flow-column">
              <div className="landing-flow-col-header">
                <span className="landing-flow-col-title">Sources</span>
                <span className="landing-flow-pill">Input</span>
              </div>

              <div className="landing-connector-card active">
                <div className="landing-connector-icon">
                  <Globe size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">REST API</span>
                  <span className="landing-connector-type">HTTP GET / POST JSON</span>
                </div>
              </div>

              <div className="landing-connector-card">
                <div className="landing-connector-icon">
                  <Database size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">PostgreSQL</span>
                  <span className="landing-connector-type">Relational Table Scan</span>
                </div>
              </div>

              <div className="landing-connector-card">
                <div className="landing-connector-icon">
                  <Database size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">MySQL</span>
                  <span className="landing-connector-type">Relational Table Scan</span>
                </div>
              </div>

              <div className="landing-connector-card">
                <div className="landing-connector-icon">
                  <FileText size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">CSV File</span>
                  <span className="landing-connector-type">Tabular Records</span>
                </div>
              </div>
            </div>

            {/* FLOW ARROW 1 */}
            <div className="landing-flow-arrow" aria-hidden="true">
              <span className="landing-flow-arrow-badge">Extract</span>
              <ChevronRight size={24} className="landing-flow-arrow-icon" />
            </div>

            {/* 2. TRANSFORM HUB */}
            <div className="landing-flow-column" style={{ background: '#fdfcfe', borderColor: 'var(--landing-primary)' }}>
              <div className="landing-flow-col-header">
                <span className="landing-flow-col-title" style={{ color: 'var(--landing-primary)' }}>
                  Transform Engine
                </span>
                <span className="landing-flow-pill" style={{ background: 'var(--landing-primary)', color: '#fff' }}>
                  Processing
                </span>
              </div>

              <div className="landing-connector-card active" style={{ borderColor: 'rgba(79, 70, 229, 0.3)' }}>
                <div className="landing-connector-icon" style={{ background: 'var(--landing-primary-light)' }}>
                  <Shuffle size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">Field Mapping</span>
                  <span className="landing-connector-type">1-to-1 Schema Alignment</span>
                </div>
              </div>

              <div className="landing-connector-card active" style={{ borderColor: 'rgba(79, 70, 229, 0.3)' }}>
                <div className="landing-connector-icon" style={{ background: 'var(--landing-primary-light)' }}>
                  <Shield size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">Data Masking & Hash</span>
                  <span className="landing-connector-type">Redact PII & SHA-256</span>
                </div>
              </div>

              <div className="landing-connector-card active" style={{ borderColor: 'rgba(79, 70, 229, 0.3)' }}>
                <div className="landing-connector-icon" style={{ background: 'var(--landing-primary-light)' }}>
                  <Activity size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">Type Casting</span>
                  <span className="landing-connector-type">STRING, NUMBER, DATE, JSON</span>
                </div>
              </div>

              <div className="landing-connector-card active" style={{ borderColor: 'rgba(79, 70, 229, 0.3)' }}>
                <div className="landing-connector-icon" style={{ background: 'var(--landing-primary-light)' }}>
                  <CheckCircle2 size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">Metadata Injection</span>
                  <span className="landing-connector-type">_ingestedAt & _pipelineId</span>
                </div>
              </div>
            </div>

            {/* FLOW ARROW 2 */}
            <div className="landing-flow-arrow" aria-hidden="true">
              <span className="landing-flow-arrow-badge">Load</span>
              <ChevronRight size={24} className="landing-flow-arrow-icon" />
            </div>

            {/* 3. DESTINATION COLUMN */}
            <div className="landing-flow-column">
              <div className="landing-flow-col-header">
                <span className="landing-flow-col-title">Destinations</span>
                <span className="landing-flow-pill">Output</span>
              </div>

              <div className="landing-connector-card active">
                <div className="landing-connector-icon">
                  <Server size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">MongoDB</span>
                  <span className="landing-connector-type">JSON Document Store</span>
                </div>
              </div>

              <div className="landing-connector-card">
                <div className="landing-connector-icon">
                  <Database size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">PostgreSQL</span>
                  <span className="landing-connector-type">Relational Row Insert</span>
                </div>
              </div>

              <div className="landing-connector-card">
                <div className="landing-connector-icon">
                  <Database size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">MySQL</span>
                  <span className="landing-connector-type">Relational Row Insert</span>
                </div>
              </div>

              <div className="landing-connector-card">
                <div className="landing-connector-icon">
                  <FileText size={16} />
                </div>
                <div className="landing-connector-info">
                  <span className="landing-connector-name">CSV File</span>
                  <span className="landing-connector-type">Tabular File Export</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
