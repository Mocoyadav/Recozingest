import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Workflow,
  Database,
  HardDrive,
  History,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useToast } from '../../hooks/useToast.js';

const NAV_ITEMS = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    isImplemented: true
  },
  {
    path: '/pipelines',
    label: 'Pipelines',
    icon: Workflow,
    isImplemented: true
  },
  {
    path: '/sources',
    label: 'Sources',
    icon: Database,
    isImplemented: true
  },
  {
    path: '/destinations',
    label: 'Destinations',
    icon: HardDrive,
    isImplemented: true
  },
  {
    path: '/history',
    label: 'Run History',
    icon: History,
    isImplemented: true
  }
];

export function Sidebar({
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile
}) {
  const toast = useToast();

  const handleFutureClick = (e, item) => {
    if (!item.isImplemented) {
      e.preventDefault();
      toast.info(`${item.label} will be implemented in upcoming ${item.badge}.`);
    } else if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 90
          }}
        />
      )}

      <aside
        className={`app-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: isCollapsed ? '72px' : '250px',
          transition: 'width var(--transition-normal), transform var(--transition-normal)'
        }}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon" aria-hidden="true">
            <Workflow size={18} />
          </div>
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ lineHeight: 1.2 }}>
                Ricoz<span style={{ color: 'var(--accent)' }}>Ingest</span>
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                Data Platform
              </span>
            </div>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="sidebar-collapse-btn"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: 'var(--radius-xs)',
                transition: 'color var(--transition-fast)'
              }}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          {!isCollapsed && <span className="nav-group-title">Navigation</span>}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={(e) => handleFutureClick(e, item)}
                className={({ isActive }) =>
                  `nav-link ${isActive && item.isImplemented ? 'active' : ''}`
                }
                title={isCollapsed ? item.label : undefined}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '0.625rem 0' : '0.625rem 0.75rem',
                  opacity: item.isImplemented ? 1 : 0.75
                }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!isCollapsed && (
                  <>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className="nav-badge"
                        style={{
                          fontSize: '0.625rem',
                          padding: '0.125rem 0.375rem',
                          background: 'var(--bg-surface-elevated)',
                          borderRadius: 'var(--radius-xs)',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--success)',
                  boxShadow: '0 0 8px var(--success)'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Engine Operational
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                v1.0
              </span>
            </div>
          ) : (
            <div
              style={{
                width: '8px',
                height: '8px',
                margin: '0 auto',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--success)'
              }}
              title="Engine Operational"
            />
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
