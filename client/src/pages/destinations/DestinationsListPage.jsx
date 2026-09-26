import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  Server,
  Database,
  FileText,
  Edit2,
  Trash2,
  AlertTriangle,
  HardDrive,
  Layers,
  ShieldCheck
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import DestinationFormModal from './DestinationFormModal.jsx';
import destinationService from '../../services/destination.service.js';
import { formatDate, formatRelativeTime } from '../../utils/formatters.js';
import { useToast } from '../../hooks/useToast.js';

export function DestinationsListPage() {
  const toast = useToast();

  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState(null);

  // Delete Confirmation State
  const [deletingDestination, setDeletingDestination] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load destinations from API
  const fetchDestinations = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await destinationService.getDestinations();
      setDestinations(data.destinations || []);
      if (isManualRefresh) {
        toast.success('Destinations refreshed');
      }
    } catch (err) {
      const msg = err.message || 'Failed to retrieve data destinations.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDestinations();
  }, [fetchDestinations]);

  // Escape key closes delete modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && deletingDestination && !isDeleting) {
        setDeletingDestination(null);
      }
    };
    if (deletingDestination) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletingDestination, isDeleting]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingDestination(null);
    setIsFormOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (destination) => {
    setEditingDestination(destination);
    setIsFormOpen(true);
  };

  // Callback when destination is saved (created or updated)
  const handleDestinationSaved = (savedDestination) => {
    setDestinations((prev) => {
      const exists = prev.some((d) => d.id === savedDestination.id);
      if (exists) {
        return prev.map((d) => (d.id === savedDestination.id ? savedDestination : d));
      }
      return [savedDestination, ...prev];
    });
  };

  // Execute deletion
  const handleDeleteDestination = async () => {
    if (!deletingDestination) return;

    setIsDeleting(true);
    try {
      await destinationService.deleteDestination(deletingDestination.id);
      toast.success(`Destination "${deletingDestination.name}" deleted successfully.`);
      setDestinations((prev) => prev.filter((d) => d.id !== deletingDestination.id));
      setDeletingDestination(null);
    } catch (err) {
      toast.error(err.message || 'Failed to delete destination.');
    } finally {
      setIsDeleting(false);
    }
  };

  // In-memory search & filter
  const filteredDestinations = useMemo(() => {
    return destinations.filter((d) => {
      // Type filter
      if (typeFilter !== 'ALL' && d.type !== typeFilter) return false;
      // Status filter
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = d.name.toLowerCase().includes(query);
        const matchesDatabase = d.config?.database?.toLowerCase().includes(query);
        const matchesCollection = d.config?.collection?.toLowerCase().includes(query);
        const matchesTable = d.config?.table?.toLowerCase().includes(query);
        const matchesHost = d.config?.host?.toLowerCase().includes(query);
        return matchesName || matchesDatabase || matchesCollection || matchesTable || matchesHost;
      }
      return true;
    });
  }, [destinations, typeFilter, statusFilter, searchQuery]);

  // Connector Badge Helper
  const renderConnectorBadge = (type) => {
    switch (type) {
      case 'MONGODB':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Server size={12} /> MongoDB
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

  // Safe Connection Target Helper (Zero secrets exposed)
  const renderConfigSummary = (destination) => {
    const config = destination.config || {};
    if (destination.type === 'MONGODB') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}
            >
              {config.database || 'default'}.{config.collection || 'records'}
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                color: 'var(--success)'
              }}
              title="Credentials write-only & sanitized"
            >
              <ShieldCheck size={11} /> Redacted URI
            </span>
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Target: Database &quot;{config.database}&quot; &bull; Collection &quot;{config.collection}&quot;
          </span>
        </div>
      );
    }

    if (destination.type === 'POSTGRESQL' || destination.type === 'MYSQL') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
            {config.host || 'localhost'}:{config.port || (destination.type === 'MYSQL' ? 3306 : 5432)}/{config.database || 'db'}
          </span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Table: {config.table || 'default_table'} (Password write-only)
          </span>
        </div>
      );
    }

    if (destination.type === 'CSV') {
      return (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
          {config.filePath || 'Export file'} (delimiter: &quot;{config.delimiter || ','}&quot;)
        </span>
      );
    }

    return <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Standard target configuration</span>;
  };

  return (
    <div className="destinations-page">
      {/* Page Header */}
      <PageHeader
        title="Destinations"
        subtitle="Manage target data lakes, databases, and warehouse storage locations"
        breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Destinations' }]}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchDestinations(true)}
              disabled={loading || isRefreshing}
              title="Refresh destinations"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'badge-pulse' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenCreate}
              id="btn-create-destination"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <Plus size={16} />
              <span>New Destination</span>
            </button>
          </div>
        }
      />

      {/* Error Alert with Retry */}
      {error && (
        <div className="auth-alert-error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Unable to Load Destinations:</strong> {error}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchDestinations()}
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
              aria-label="Search destinations"
              placeholder="Search by destination name, database, or collection..."
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
                aria-label="Filter by destination type"
                style={{ width: 'auto', minWidth: '130px' }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="MONGODB">MongoDB</option>
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

      {/* Destinations Data Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HardDrive size={18} color="var(--primary)" />
              Configured Destinations
            </h3>
            <p className="card-subtitle">
              {filteredDestinations.length} of {destinations.length} destinations matched
            </p>
          </div>
          <span className="badge badge-muted">
            {destinations.length} Total
          </span>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
              <span className="spinner spinner-lg"></span>
            </div>
          ) : filteredDestinations.length === 0 ? (
            <div className="empty-state">
              <Server size={36} className="empty-state-icon" />
              <h4 className="empty-state-title">
                {destinations.length === 0 ? 'No Data Destinations Configured' : 'No Destinations Match Your Filter'}
              </h4>
              <p className="empty-state-desc">
                {destinations.length === 0
                  ? 'Connect MongoDB, PostgreSQL, MySQL, or CSV destination targets to receive loaded records from your pipelines.'
                  : 'Try adjusting your search terms or filter selections.'}
              </p>
              {destinations.length === 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenCreate}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Plus size={16} />
                  <span>Configure Your First Destination</span>
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Destination Name</th>
                  <th>Type</th>
                  <th>Target Schema / Endpoint</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDestinations.map((destination) => {
                  const isActive = destination.status === 'ACTIVE';

                  return (
                    <tr key={destination.id}>
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
                            {destination.name}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            ID: {destination.id}
                          </span>
                        </div>
                      </td>
                      <td style={{ width: '130px' }}>
                        {renderConnectorBadge(destination.type)}
                      </td>
                      <td style={{ maxWidth: '380px' }}>
                        {renderConfigSummary(destination)}
                      </td>
                      <td style={{ width: '120px', fontSize: '0.75rem', color: 'var(--text-muted)' }} title={formatDate(destination.createdAt)}>
                        {formatRelativeTime(destination.createdAt)}
                      </td>
                      <td style={{ textAlign: 'right', width: '100px' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleOpenEdit(destination)}
                            title="Edit destination"
                            aria-label={`Edit ${destination.name}`}
                            style={{ padding: '0.375rem', height: '30px', width: '30px' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setDeletingDestination(destination)}
                            title="Delete destination"
                            aria-label={`Delete ${destination.name}`}
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

      {/* Destination Form Modal (Create / Edit) */}
      <DestinationFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={handleDestinationSaved}
        destination={editingDestination}
      />

      {/* Delete Confirmation Modal */}
      {deletingDestination && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeletingDestination(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-destination-title"
        >
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 id="delete-destination-title" className="card-title" style={{ color: 'var(--danger)' }}>
                Delete Destination Connector
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to delete the destination{' '}
                <strong style={{ color: 'var(--text-primary)' }}>&quot;{deletingDestination.name}&quot;</strong>?
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>
                Any pipelines currently loading data into this target will fail unless re-configured. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingDestination(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteDestination}
                disabled={isDeleting}
                id="btn-confirm-delete-destination"
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
                    <span>Delete Destination</span>
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

export default DestinationsListPage;
