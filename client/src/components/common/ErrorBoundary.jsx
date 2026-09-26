import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Sanitize error messages to ensure zero sensitive tokens, connection strings, or credentials leak
 */
function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return 'An unexpected application error occurred.';
  let sanitized = msg;
  sanitized = sanitized.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, 'mongodb://[REDACTED]');
  sanitized = sanitized.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@');
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  sanitized = sanitized.replace(/(?:api[_-]?key|apikey|password|passwd|pwd|secret|token)["']?\s*[:=]\s*["']?[^"',;\s]+/gi, 'credential: [REDACTED]');
  return sanitized;
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error, errorInfo) {
    // Intentionally avoid logging credentials or raw headers
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary caught error]:', error?.message);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const sanitizedMsg = sanitizeErrorMessage(this.state.error?.message);

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: 'var(--bg-canvas)'
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '2rem',
              textAlign: 'center',
              boxShadow: 'var(--shadow-xl)',
              borderColor: 'rgba(239, 68, 68, 0.2)'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem'
              }}
            >
              Something Went Wrong
            </h2>

            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: '1.25rem'
              }}
            >
              An unexpected interface error occurred. Your pipelines, sources, and data remain safe and unaffected.
            </p>

            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                textAlign: 'left',
                marginBottom: '1.5rem',
                maxHeight: '100px',
                overflowY: 'auto'
              }}
            >
              {sanitizedMsg}
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center'
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleReset}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <RefreshCw size={14} />
                <span>Try Again</span>
              </button>

              <a
                href="/dashboard"
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}
              >
                <Home size={14} />
                <span>Return to Dashboard</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
