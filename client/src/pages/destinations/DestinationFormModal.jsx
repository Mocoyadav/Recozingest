import React, { useState, useEffect } from 'react';
import { X, Server, Database, FileText, AlertCircle, Check } from 'lucide-react';
import destinationService from '../../services/destination.service.js';
import { useToast } from '../../hooks/useToast.js';

const CONNECTOR_TYPES = [
  { value: 'MONGODB', label: 'MongoDB', icon: Server, description: 'Store JSON documents in MongoDB collections' },
  { value: 'POSTGRESQL', label: 'PostgreSQL', icon: Database, description: 'Insert rows into PostgreSQL database tables' },
  { value: 'MYSQL', label: 'MySQL', icon: Database, description: 'Insert rows into MySQL database tables' },
  { value: 'CSV', label: 'CSV File', icon: FileText, description: 'Append or export records to local/mounted CSV files' }
];

export function DestinationFormModal({ isOpen, onClose, onSaved, destination = null }) {
  const toast = useToast();
  const isEditing = Boolean(destination && destination.id);

  const [name, setName] = useState('');
  const [type, setType] = useState('MONGODB');
  const [status, setStatus] = useState('ACTIVE');

  // MongoDB Config Fields
  const [uri, setUri] = useState('');
  const [database, setDatabase] = useState('');
  const [collection, setCollection] = useState('');

  // Relational Config Fields (PostgreSQL / MySQL)
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [table, setTable] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // CSV Config Fields
  const [filePath, setFilePath] = useState('');
  const [delimiter, setDelimiter] = useState(',');

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form state
  useEffect(() => {
    if (!isOpen) return;

    if (destination) {
      setName(destination.name || '');
      setType(destination.type || 'MONGODB');
      setStatus(destination.status || 'ACTIVE');

      const config = destination.config || {};
      if (destination.type === 'MONGODB') {
        // URI is write-only; never displayed from backend
        setUri('');
        setDatabase(config.database || '');
        setCollection(config.collection || '');
      } else if (destination.type === 'POSTGRESQL' || destination.type === 'MYSQL') {
        setHost(config.host || '');
        setPort(config.port ? String(config.port) : destination.type === 'MYSQL' ? '3306' : '5432');
        setDatabase(config.database || '');
        setTable(config.table || '');
        setUsername(config.user || config.username || '');
        setPassword(''); // Password is write-only
      } else if (destination.type === 'CSV') {
        setFilePath(config.filePath || config.path || '');
        setDelimiter(config.delimiter || ',');
      }
    } else {
      // New Destination Defaults
      setName('');
      setType('MONGODB');
      setStatus('ACTIVE');
      setUri('');
      setDatabase('');
      setCollection('');
      setHost('');
      setPort('5432');
      setTable('');
      setUsername('');
      setPassword('');
      setFilePath('');
      setDelimiter(',');
    }

    setErrors({});
    setServerError('');
    setIsSubmitting(false);
  }, [isOpen, destination]);

  // Adjust default port when type switches
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
      errs.name = 'Destination name is required';
    }

    if (type === 'MONGODB') {
      if (!isEditing && !uri.trim()) {
        errs.uri = 'Connection URI is required';
      }
      if (!database.trim()) {
        errs.database = 'Database name is required';
      }
      if (!collection.trim()) {
        errs.collection = 'Collection name is required';
      }
    } else if (type === 'POSTGRESQL' || type === 'MYSQL') {
      if (!host.trim()) errs.host = 'Host is required';
      if (!database.trim()) errs.database = 'Database name is required';
      if (!table.trim()) errs.table = 'Target table is required';
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
      let config = {};

      if (type === 'MONGODB') {
        config = {
          database: database.trim(),
          collection: collection.trim()
        };
        // Write-only URI: attach if user typed a value; omit if blank during edit
        if (uri.trim()) {
          config.uri = uri.trim();
        }
      } else if (type === 'POSTGRESQL' || type === 'MYSQL') {
        config = {
          host: host.trim(),
          port: parseInt(port, 10) || (type === 'MYSQL' ? 3306 : 5432),
          database: database.trim(),
          table: table.trim(),
          user: username.trim()
        };
        if (password) {
          config.password = password;
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
        result = await destinationService.updateDestination(destination.id, payload);
        toast.success(`Destination "${result.destination.name}" updated successfully`);
      } else {
        result = await destinationService.createDestination(payload);
        toast.success(`Destination "${result.destination.name}" created successfully`);
      }

      onSaved(result.destination);
      onClose();
    } catch (err) {
      const message = err.message || `Failed to ${isEditing ? 'update' : 'create'} destination.`;
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
      aria-labelledby="destination-modal-title"
    >
      <div className="modal-container" style={{ maxWidth: '640px' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3 id="destination-modal-title" className="card-title" style={{ fontSize: '1.125rem' }}>
              {isEditing ? 'Edit Destination Connector' : 'Configure New Destination'}
            </h3>
            <p className="card-subtitle" style={{ fontSize: '0.8125rem' }}>
              {isEditing
                ? 'Update target settings for this destination repository.'
                : 'Define a destination data store where ingested and transformed records are loaded.'}
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {serverError && (
              <div className="auth-alert-error" role="alert">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{serverError}</span>
              </div>
            )}

            {/* Destination Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="dest-name">
                Destination Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="dest-name"
                type="text"
                className={`form-control ${errors.name ? 'has-error' : ''}`}
                placeholder="e.g., Central Data Lake, Analytics Warehouse"
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
              <label className="form-label">Destination Type</label>
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

            {/* Type-Specific Configuration Panels */}
            {type === 'MONGODB' && (
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
                  <Server size={16} color="var(--success)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    MongoDB Target Configuration
                  </span>
                </div>

                {/* Connection URI (Write-Only) */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" htmlFor="dest-uri">
                      Connection URI {!isEditing && <span style={{ color: 'var(--danger)' }}>*</span>}
                    </label>
                    {isEditing && (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--accent)' }}>
                        Write-only credential
                      </span>
                    )}
                  </div>
                  <input
                    id="dest-uri"
                    type="password"
                    className={`form-control ${errors.uri ? 'has-error' : ''}`}
                    placeholder={
                      isEditing
                        ? 'Leave blank to keep existing connection URI'
                        : 'mongodb://username:password@localhost:27017 or mongodb+srv://...'
                    }
                    value={uri}
                    onChange={(e) => {
                      setUri(e.target.value);
                      if (errors.uri) setErrors((prev) => ({ ...prev, uri: null }));
                    }}
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                  {errors.uri && <span className="auth-input-error">{errors.uri}</span>}
                </div>

                {/* Database & Collection Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="dest-db">
                      Database <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      id="dest-db"
                      type="text"
                      className={`form-control ${errors.database ? 'has-error' : ''}`}
                      placeholder="e.g. ricozingest_lake"
                      value={database}
                      onChange={(e) => {
                        setDatabase(e.target.value);
                        if (errors.database) setErrors((prev) => ({ ...prev, database: null }));
                      }}
                      disabled={isSubmitting}
                    />
                    {errors.database && <span className="auth-input-error">{errors.database}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="dest-coll">
                      Collection <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      id="dest-coll"
                      type="text"
                      className={`form-control ${errors.collection ? 'has-error' : ''}`}
                      placeholder="e.g. processed_customers"
                      value={collection}
                      onChange={(e) => {
                        setCollection(e.target.value);
                        if (errors.collection) setErrors((prev) => ({ ...prev, collection: null }));
                      }}
                      disabled={isSubmitting}
                    />
                    {errors.collection && <span className="auth-input-error">{errors.collection}</span>}
                  </div>
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
                    {type === 'POSTGRESQL' ? 'PostgreSQL' : 'MySQL'} Target Credentials
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Host <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="db.internal.corp or localhost"
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
                      placeholder="warehouse"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.database && <span className="auth-input-error">{errors.database}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Table <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="ingested_events"
                      value={table}
                      onChange={(e) => setTable(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.table && <span className="auth-input-error">{errors.table}</span>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="db_writer"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder={isEditing ? 'Leave blank to keep existing credential' : '••••••••••••'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                  </div>
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
                    CSV Export File Settings
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Output File Path <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="/data/warehouse/export_customers.csv"
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
                  Destination Status
                </span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Active destinations can be selected as loaded targets in pipeline definitions.
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
              id="btn-save-destination"
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
                  <span>{isEditing ? 'Save Changes' : 'Create Destination'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DestinationFormModal;
