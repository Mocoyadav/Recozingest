import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Reusable page header component supporting titles, descriptions, breadcrumbs, and action buttons.
 *
 * @param {Object} props
 * @param {string} props.title - Primary heading text
 * @param {string} [props.subtitle] - Supporting description text
 * @param {Array<{ label: string, path?: string }>} [props.breadcrumbs] - Array of breadcrumb items
 * @param {React.ReactNode} [props.actions] - Optional action buttons slot
 * @param {React.ReactNode} [props.children] - Additional slot content
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
  children
}) {
  return (
    <div className="page-header-wrapper" style={{ marginBottom: '1.75rem' }}>
      {/* Optional Breadcrumb Navigation */}
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumbs"
          className="topbar-breadcrumbs"
          style={{ marginBottom: '0.625rem' }}
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                {isLast || !crumb.path ? (
                  <span className="current" aria-current={isLast ? 'page' : undefined}>
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    style={{
                      color: 'var(--text-muted)',
                      textDecoration: 'none',
                      transition: 'color var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Main Header Row */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>

        {actions && (
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

export default PageHeader;
