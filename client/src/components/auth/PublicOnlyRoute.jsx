import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * Route guard for public-only pages (e.g. Login, Register).
 * Prevents already-authenticated users from revisiting login/register needlessly.
 */
export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-primary)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner spinner-lg"></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const fromPath = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={fromPath} replace />;
  }

  return children ? children : <Outlet />;
}

export default PublicOnlyRoute;
