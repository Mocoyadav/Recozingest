import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home, Workflow } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center'
      }}
      role="main"
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '2.5rem 2rem'
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}
        >
          <Compass size={32} />
        </div>

        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
            letterSpacing: '-0.02em'
          }}
        >
          404
        </h1>

        <h2
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem'
          }}
        >
          Page Not Found
        </h2>

        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            marginBottom: '1.75rem'
          }}
        >
          The page you are looking for doesn't exist or may have been moved.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/dashboard"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Home size={15} />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/pipelines"
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Workflow size={15} />
            <span>Pipelines</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
