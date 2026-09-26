import React, { useState, useEffect } from 'react';
import { X, Globe, Database, FileText, AlertCircle, Check } from 'lucide-react';
import sourceService from '../../services/source.service.js';
import { useToast } from '../../hooks/useToast.js';

const CONNECTOR_TYPES = [
  { value: 'REST_API', label: 'REST API', icon: Globe, description: 'Extract records via HTTP GET/POST endpoints' },
  { value: 'POSTGRESQL', label: 'PostgreSQL', icon: Database, description: 'Extract from PostgreSQL relational tables' },
  { value: 'MYSQL', label: 'MySQL', icon: Database, description: 'Extract from MySQL relational tables' },
  { value: 'CSV', label: 'CSV File', icon: FileText, description: 'Extract flat tabular records from local or mounted CSV' }
];

export function SourceFormModal({ isOpen, onClose, onSaved, source = null }) {
  const toast = useToast();
  const isEditing = Boolean(source && source.id);

  const [name, setName] = useState('');
  const [type, setType] = useState('REST_API');
  const [status, setStatus] = useState('ACTIVE');

  // REST API Config Fields
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [headersJson, setHeadersJson] = useState('');

  // Database Config Fields (PostgreSQL / MySQL)
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // CSV Config Fields
  const [filePath, setFilePath] = useState('');
  const [delimiter, setDelimiter] = useState(',');

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form state when modal opens or source changes
  useEffect(() => {
    if (!isOpen) return;

    if (source) {
      setName(source.name || '');
      setType(source.type || 'REST_API');
      setStatus(source.status || 'ACTIVE');

      const config = source.config || {};
      if (source.type === 'REST_API') {
        setUrl(config.url || '');
        setMethod(config.method || 'GET');
        setHeadersJson(config.headers ? JSON.stringify(config.headers, null, 2) : '');
      } else if (source.type === 'POSTGRESQL' || source.type === 'MYSQL') {
        setHost(config.host || '');
        setPort(config.port ? String(config.port) : source.type === 'MYSQL' ? '3306' : '5432');
        setDatabase(config.database || '');
        setUsername(config.user || config.username || '');
        setPassword(''); // Write-only security
      } else if (source.type === 'CSV') {
        setFilePath(config.filePath || config.path || '');
        setDelimiter(config.delimiter || ',');
      }
    } else {
      // New Source defaults
      setName('');
      setType('REST_API');
      setStatus('ACTIVE');
      setUrl('');
      setMethod('GET');
      setHeadersJson('');
      setHost('');
      setPort('5432');
      setDatabase('');
      setUsername('');
      setPassword('');
      setFilePath('');
      setDelimiter(',');
    }

    setErrors({});
    setServerError('');
    setIsSubmitting(false);
  }, [isOpen, source]);

  // Escape key closes modal if not submitting
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  // Adjust default port when type changes for new sources
  const handleTypeChange = (newType) => {
    setType(newType);
    if (!isEditing) {
      if (newType === 'POSTGRESQL') setPort('5432');
      if (newType === 'MYSQL') setPort('3306');
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!name.trim()) {
      errs.name = 'Source name is required';
    }

    if (type === 'REST_API') {
      if (!url.trim()) {
        errs.url = 'Endpoint URL is required';
      } else if (!/^https?:\/\/.+/i.test(url.trim())) {
        errs.url = 'URL must start with http:// or https://';
      }

      if (headersJson.trim()) {
        try {
          const parsed = JSON.parse(headersJson.trim());
          if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
            errs.headersJson = 'Headers must be a valid JSON key-value object';
          }
        } catch {
          errs.headersJson = 'Invalid JSON format';
        }
      }
    } else if (type === 'POSTGRESQL' || type === 'MYSQL') {
      if (!host.trim()) errs.host = 'Host is required';
      if (!database.trim()) errs.database = 'Database name is required';
    } else if (type === 'CSV') {
      if (!filePath.trim()) errs.filePath = 'File path is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // Build config object based on selected connector type
      let config = {};

      if (type === 'REST_API') {
        let headers = {};
        if (headersJson.trim()) {
          headers = JSON.parse(headersJson.trim());
        }
        config = {
          url: url.trim(),
          method: method.toUpperCase(),
          headers
        };
      } else if (type === 'POSTGRESQL' || type === 'MYSQL') {
        config = {
          host: host.trim(),
          port: parseInt(port, 10) || (type === 'MYSQL' ? 3306 : 5432),
          database: database.trim(),
          user: username.trim()
        };
        // Only attach password if supplied (write-only protection)
        if (password) {
          config.password = password;
        } else if (isEditing && source?.config?.password) {
          config.password = source.config.password;
        }
      } else if (type === 'CSV') {
        config = {
          filePath: filePath.trim(),
          delimiter: delimiter || ','
        };
      }

      const payload = {
        name: name.trim(),
        type,
        config,
        status
      };

      let result;
      if (isEditing) {
        result = await sourceService.updateSource(source.id, payload);
        toast.success(`Source "${result.source.name}" updated successfully`);
      } else {
        result = await sourceService.createSource(payload);
        toast.success(`Source "${result.source.name}" created successfully`);
      }

      onSaved(result.source);
      onClose();
    } catch (err) {
      const message = err.message || `Failed to ${isEditing ? 'update' : 'create'} source.`;
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-modal-title"
    >
      <div className="modal-container" style={{ maxWidth: '640px' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3 id="source-modal-title" className="card-title" style={{ fontSize: '1.125rem' }}>
              {isEditing ? 'Edit Source Connector' : 'Configure New Source'}
            </h3>
            <p className="card-subtitle" style={{ fontSize: '0.8125rem' }}>
              {isEditing
                ? 'Update connection settings for this existing data source.'
                : 'Connect RicozIngest to an external source to extract records.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: '4px',
              display: 'flex',
              borderRadius: 'var(--radius-xs)'
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {serverError && (
              <div className="auth-alert-error" role="alert">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{serverError}</span>
              </div>
            )}

            {/* Source Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="source-name">
                Source Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="source-name"
                type="text"
                className={`form-control ${errors.name ? 'has-error' : ''}`}
                placeholder="e.g., Production Customer API, Inventory DB"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                }}
                disabled={isSubmitting}
                autoFocus
              />
              {errors.name && <span className="auth-input-error">{errors.name}</span>}
            </div>

            {/* Connector Type Selector */}
            <div className="form-group">
              <label className="form-label">Connector Type</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.625rem'
                }}
              >
                {CONNECTOR_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleTypeChange(t.value)}
                      disabled={isSubmitting}
                      style={{
                        padding: '0.75rem 0.625rem',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected
                          ? '1px solid var(--primary)'
                          : '1px solid var(--border-default)',
                        backgroundColor: isSelected
                          ? 'var(--primary-light)'
                          : 'var(--bg-surface-elevated)',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.375rem',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <Icon size={20} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type-Specific Configuration Fields */}
            {type === 'REST_API' && (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Globe size={16} color="var(--primary)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    REST API Connection Settings
                  </span>
                </div>

                {/* Method & URL Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="rest-method">
                      Method
                    </label>
                    <select
                      id="rest-method"
                      className="form-select"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="rest-url">
                      Endpoint URL <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      id="rest-url"
                      type="url"
                      className={`form-control ${errors.url ? 'has-error' : ''}`}
                      placeholder="https://api.example.com/v1/records"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (errors.url) setErrors((prev) => ({ ...prev, url: null }));
                      }}
                      disabled={isSubmitting}
                    />
                    {errors.url && <span className="auth-input-error">{errors.url}</span>}
                  </div>
                </div>

                {/* Headers JSON */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" htmlFor="rest-headers">
                      Headers (JSON Object, Optional)
                    </label>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      e.g., authorization, api keys
                    </span>
                  </div>
                  <textarea
                    id="rest-headers"
                    className={`form-control ${errors.headersJson ? 'has-error' : ''}`}
                    rows={3}
                    placeholder={'{\n  "Accept": "application/json"\n}'}
                    value={headersJson}
                    onChange={(e) => {
                      setHeadersJson(e.target.value);
                      if (errors.headersJson) setErrors((prev) => ({ ...prev, headersJson: null }));
                    }}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                    disabled={isSubmitting}
                  />
                  {errors.headersJson && (
                    <span className="auth-input-error">{errors.headersJson}</span>
                  )}
                </div>
              </div>
            )}

            {(type === 'POSTGRESQL' || type === 'MYSQL') && (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Database size={16} color="var(--primary)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {type === 'POSTGRESQL' ? 'PostgreSQL' : 'MySQL'} Database Credentials
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Host <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="db.internal.net or localhost"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.host && <span className="auth-input-error">{errors.host}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Port</label>
                    <input
                      type="number"
                      className="form-control"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Database <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="analytics_db"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.database && <span className="auth-input-error">{errors.database}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="db_read_user"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Password {isEditing ? '(Write-only, leave blank to retain existing)' : ''}
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {type === 'CSV' && (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <FileText size={16} color="var(--primary)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    CSV File Path Configuration
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">File Path <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="/data/raw/transactions.csv"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    disabled={isSubmitting}
                  />
                  {errors.filePath && <span className="auth-input-error">{errors.filePath}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Delimiter</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ maxWidth: '80px' }}
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}

            {/* Active Status Switch */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0' }}>
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Connector Status
                </span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Active connectors can be linked to pipelines for automated executions.
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={status === 'ACTIVE'}
                  onChange={(e) => setStatus(e.target.checked ? 'ACTIVE' : 'INACTIVE')}
                  disabled={isSubmitting}
                />
                <span className="switch-track">
                  <span className="switch-thumb"></span>
                </span>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              id="btn-save-source"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  <span>{isEditing ? 'Saving...' : 'Creating...'}</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{isEditing ? 'Save Changes' : 'Create Source'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SourceFormModal;
