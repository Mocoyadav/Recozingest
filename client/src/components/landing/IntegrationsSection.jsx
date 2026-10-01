import React, { useState } from 'react';
import { Globe, Database, FileText, Server, Check } from 'lucide-react';

const SOURCES = [
  {
    name: 'REST API',
    type: 'HTTP Endpoints',
    description: 'Extract JSON payloads using configurable GET and POST requests with custom headers.',
    icon: Globe
  },
  {
    name: 'PostgreSQL',
    type: 'Relational Database',
    description: 'Extract records from PostgreSQL tables with cursor-based incremental sync support.',
    icon: Database
  },
  {
    name: 'MySQL',
    type: 'Relational Database',
    description: 'Query and extract relational data from MySQL databases securely.',
    icon: Database
  },
  {
    name: 'CSV File',
    type: 'Tabular Data',
    description: 'Ingest structured flat records from comma-separated values files.',
    icon: FileText
  }
];

const DESTINATIONS = [
  {
    name: 'MongoDB',
    type: 'Document Database',
    description: 'Load structured JSON documents directly into target MongoDB collections.',
    icon: Server
  },
  {
    name: 'PostgreSQL',
    type: 'Relational Database',
    description: 'Insert transformed records into PostgreSQL destination tables with schema mapping.',
    icon: Database
  },
  {
    name: 'MySQL',
    type: 'Relational Database',
    description: 'Load pipeline data into MySQL destination tables with type validation.',
    icon: Database
  },
  {
    name: 'CSV File',
    type: 'Tabular Export',
    description: 'Export and append pipeline output to disk or mounted volume storage.',
    icon: FileText
  }
];

export function IntegrationsSection() {
  const [filterTab, setFilterTab] = useState('ALL');

  const showSources = filterTab === 'ALL' || filterTab === 'SOURCES';
  const showDestinations = filterTab === 'ALL' || filterTab === 'DESTINATIONS';

  return (
    <section id="integrations" className="landing-section" aria-labelledby="integrations-heading">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-section-tag">Supported Connectors</span>
          <h2 id="integrations-heading" className="landing-section-title">
            Connect the Tools Your Business Uses
          </h2>
          <p className="landing-section-subtitle">
            Reliable native connectors for your production databases, APIs, and file stores.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="landing-integrations-tabs" role="tablist" aria-label="Connector category filters">
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'ALL'}
            className={`landing-tab-btn ${filterTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterTab('ALL')}
          >
            All Connectors (8)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'SOURCES'}
            className={`landing-tab-btn ${filterTab === 'SOURCES' ? 'active' : ''}`}
            onClick={() => setFilterTab('SOURCES')}
          >
            Data Sources (4)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'DESTINATIONS'}
            className={`landing-tab-btn ${filterTab === 'DESTINATIONS' ? 'active' : ''}`}
            onClick={() => setFilterTab('DESTINATIONS')}
          >
            Data Destinations (4)
          </button>
        </div>

        <div className="landing-integrations-columns">
          {/* Sources Panel */}
          {showSources && (
            <div className="landing-integrations-panel">
              <div className="landing-integrations-panel-title">
                <Database size={20} color="var(--landing-primary)" />
                <span>Source Connectors</span>
              </div>
              <p className="landing-integrations-panel-desc">
                Extract records via REST endpoints, relational tables, and flat files.
              </p>

              <div className="landing-integrations-list">
                {SOURCES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.name} className="landing-integration-card">
                      <div className="landing-integration-top">
                        <div className="landing-integration-icon-wrap">
                          <Icon size={18} />
                        </div>
                        <span className="landing-integration-badge">Source</span>
                      </div>
                      <h4 className="landing-integration-name">{item.name}</h4>
                      <p className="landing-integration-desc">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Destinations Panel */}
          {showDestinations && (
            <div className="landing-integrations-panel">
              <div className="landing-integrations-panel-title">
                <Server size={20} color="var(--landing-accent)" />
                <span>Destination Connectors</span>
              </div>
              <p className="landing-integrations-panel-desc">
                Deliver clean, transformed data to databases, collections, and files.
              </p>

              <div className="landing-integrations-list">
                {DESTINATIONS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.name} className="landing-integration-card">
                      <div className="landing-integration-top">
                        <div className="landing-integration-icon-wrap">
                          <Icon size={18} />
                        </div>
                        <span className="landing-integration-badge" style={{ color: 'var(--landing-accent)', borderColor: 'var(--landing-accent)', background: 'var(--landing-accent-light)' }}>
                          Destination
                        </span>
                      </div>
                      <h4 className="landing-integration-name">{item.name}</h4>
                      <p className="landing-integration-desc">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default IntegrationsSection;
