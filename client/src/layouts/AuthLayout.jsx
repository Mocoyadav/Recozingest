import React from 'react';
import { Outlet } from 'react-router-dom';
import { Workflow } from 'lucide-react';

/**
 * Centered layout shell for unauthenticated authentication pages (Login, Register).
 */
export function AuthLayout({ children }) {
  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-logo-badge" aria-hidden="true">
            <Workflow size={26} />
          </div>
          <h1 className="auth-brand-name">
            Ricoz<span>Ingest</span>
          </h1>
          <p className="auth-brand-tagline">
            High-Performance Data Ingestion & Transformation Platform
          </p>
        </div>

        {/* Content Card (Page view injected via React Router Outlet) */}
        <div className="auth-card">
          {children || <Outlet />}
        </div>

        {/* Brand Footer */}
        <footer className="auth-footer">
          <p>&copy; {new Date().getFullYear()} RicozIngest Platform &bull; Safe, Isolated & Schema-Aware</p>
        </footer>
      </div>
    </div>
  );
}

export default AuthLayout;
