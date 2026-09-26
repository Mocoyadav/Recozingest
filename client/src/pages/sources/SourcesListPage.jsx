import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  Globe,
  Database,
  FileText,
  Edit2,
  Trash2,
  AlertTriangle,
  Server,
  Layers,
  CheckCircle2,
  XCircle,
  ExternalLink
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import SourceFormModal from './SourceFormModal.jsx';
import sourceService from '../../services/source.service.js';
import { formatDate, formatRelativeTime } from '../../utils/formatters.js';
import { useToast } from '../../hooks/useToast.js';

export function SourcesListPage() {
  const toast = useToast();

  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);

  // Delete Confirmation State
  const [deletingSource, setDeletingSource] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load sources from API
  const fetchSources = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await sourceService.getSources();
      setSources(data.sources || []);
      if (isManualRefresh) {
        toast.success('Sources refreshed');
      }
    } catch (err) {
      const msg = err.message || 'Failed to retrieve data sources.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Escape key closes delete modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && deletingSource && !isDeleting) {
        setDeletingSource(null);
      }
    };
    if (deletingSource) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletingSource, isDeleting]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingSource(null);
    setIsFormOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (source) => {
    setEditingSource(source);
    setIsFormOpen(true);
  };

  // Callback when source is saved (created or updated)
  const handleSourceSaved = (savedSource) => {
    setSources((prev) => {
      const exists = prev.some((s) => s.id === savedSource.id);
      if (exists) {
        return prev.map((s) => (s.id === savedSource.id ? savedSource : s));
      }
      return [savedSource, ...prev];
    });
  };

  // Execute deletion
  const handleDeleteSource = async () => {
    if (!deletingSource) return;

    setIsDeleting(true);
    try {
      await sourceService.deleteSource(deletingSource.id);
      toast.success(`Source "${deletingSource.name}" deleted successfully.`);
      setSources((prev) => prev.filter((s) => s.id !== deletingSource.id));
      setDeletingSource(null);
    } catch (err) {
      toast.error(err.message || 'Failed to delete source.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter sources in-memory
  const filteredSources = useMemo(() => {
    return sources.filter((s) => {
      // Type filter
      if (typeFilter !== 'ALL' && s.type !== typeFilter) return false;
      // Status filter
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      // Search query filter (matches name or non-sensitive config URL/host)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesUrl = s.config?.url?.toLowerCase().includes(query);
        const matchesHost = s.config?.host?.toLowerCase().includes(query);
        const matchesDatabase = s.config?.database?.toLowerCase().includes(query);
        return matchesName || matchesUrl || matchesHost || matchesDatabase;
      }
      return true;
    });
  }, [sources, typeFilter, statusFilter, searchQuery]);

  // Connector Badge Helper
  const renderConnectorBadge = (type) => {
    switch (type) {
      case 'REST_API':
        return (
          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Globe size={12} /> REST API
          </span>
        );
      case 'POSTGRESQL':
        return (
          <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Database size={12} /> PostgreSQL
          </span>
        );
      case 'MYSQL':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Database size={12} /> MySQL
          </span>
        );
      case 'CSV':
        return (
          <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <FileText size={12} /> CSV File
          </span>
        );
      default:
        return <span className="badge badge-muted">{type}</span>;
    }
  };

  // Safe Configuration Summary Helper (Excludes any passwords/secrets)
  const renderConfigSummary = (source) => {
    const config = source.config || {};
    if (source.type === 'REST_API') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--accent)'
              }}
            >
              {config.method || 'GET'}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                color: 'var(--text-primary)',
                wordBreak: 'break-all'
              }}
              title={config.url}
            >
              {config.url || 'No URL specified'}
            </span>
          </div>
          {config.headers && Object.keys(config.headers).length > 0 && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {Object.keys(config.headers).length} custom header(s) configured
            </span>
          )}
        </div>
      );
    }

    if (source.type === 'POSTGRESQL' || source.type === 'MYSQL') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
            {config.host || 'localhost'}:{config.port || (source.type === 'MYSQL' ? 3306 : 5432)}/{config.database || 'default'}
          </span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            User: {config.user || 'default'} (Password write-only)
          </span>
        </div>
      );
    }

    if (source.type === 'CSV') {
      return (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
          {config.filePath || 'Local file path'} (delimiter: &quot;{config.delimiter || ','}&quot;)
        </span>
      );
    }

    return <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Standard configuration</span>;
  };

  return (
    <div className="sources-page">
      {/* Page Header */}
      <PageHeader
        title="Sources"
        subtitle="Manage external data providers and connection configurations"
        breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Sources' }]}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchSources(true)}
              disabled={loading || isRefreshing}
              title="Refresh sources"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'badge-pulse' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenCreate}
              id="btn-create-source"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <Plus size={16} />
              <span>New Source</span>
            </button>
          </div>
        }
      />

      {/* Error Alert with Retry */}
      {error && (
        <div className="auth-alert-error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Unable to Load Sources:</strong> {error}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchSources()}
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
              aria-label="Search sources"
              placeholder="Search by source name or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          {/* Type Filter */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Type:</span>
              <select
                className="form-select"
                aria-label="Filter by source type"
                style={{ width: 'auto', minWidth: '130px' }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="REST_API">REST API</option>
                <option value="POSTGRESQL">PostgreSQL</option>
                <option value="MYSQL">MySQL</option>
                <option value="CSV">CSV File</option>
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

      {/* Sources Data Table / Content */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="var(--primary)" />
              Configured Sources
            </h3>
            <p className="card-subtitle">
              {filteredSources.length} of {sources.length} sources matched
            </p>
          </div>
          <span className="badge badge-muted">
            {sources.length} Total
          </span>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
              <span className="spinner spinner-lg"></span>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="empty-state">
              <Server size={36} className="empty-state-icon" />
              <h4 className="empty-state-title">
                {sources.length === 0 ? 'No Data Sources Configured' : 'No Sources Match Your Search'}
              </h4>
              <p className="empty-state-desc">
                {sources.length === 0
                  ? 'Connect a REST API, PostgreSQL, MySQL, or CSV data source to begin building automated pipelines.'
                  : 'Try adjusting your search query or reset the type and status filters.'}
              </p>
              {sources.length === 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenCreate}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Plus size={16} />
                  <span>Create Your First Source</span>
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Source Name</th>
                  <th>Type</th>
                  <th>Connection Target</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((source) => {
                  const isActive = source.status === 'ACTIVE';

                  return (
                    <tr key={source.id}>
                      <td style={{ width: '100px' }}>
                        <span className={`badge ${isActive ? 'badge-success' : 'badge-muted'}`}>
                          {isActive ? (
                            <>
                              <span className="badge-dot"></span> Active
                            </>
                          ) : (
                            'Inactive'
                          )}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                            {source.name}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            ID: {source.id}
                          </span>
                        </div>
                      </td>
                      <td style={{ width: '130px' }}>
                        {renderConnectorBadge(source.type)}
                      </td>
                      <td style={{ maxWidth: '380px' }}>
                        {renderConfigSummary(source)}
                      </td>
                      <td style={{ width: '120px', fontSize: '0.75rem', color: 'var(--text-muted)' }} title={formatDate(source.createdAt)}>
                        {formatRelativeTime(source.createdAt)}
                      </td>
                      <td style={{ textAlign: 'right', width: '100px' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleOpenEdit(source)}
                            title="Edit source connector"
                            aria-label={`Edit ${source.name}`}
                            style={{ padding: '0.375rem', height: '30px', width: '30px' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setDeletingSource(source)}
                            title="Delete source connector"
                            aria-label={`Delete ${source.name}`}
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

      {/* Source Form Modal (Create / Edit) */}
      <SourceFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={handleSourceSaved}
        source={editingSource}
      />

      {/* Delete Confirmation Modal */}
      {deletingSource && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeletingSource(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-source-title"
        >
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 id="delete-source-title" className="card-title" style={{ color: 'var(--danger)' }}>
                Delete Source Connector
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to delete the source{' '}
                <strong style={{ color: 'var(--text-primary)' }}>&quot;{deletingSource.name}&quot;</strong>?
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>
                Any pipelines currently relying on this source connector will fail unless re-configured. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingSource(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteSource}
                disabled={isDeleting}
                id="btn-confirm-delete-source"
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
                    <span>Delete Source</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SourcesListPage;
