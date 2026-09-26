import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form client-side before dispatching request
  const validate = () => {
    const errs = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Please provide a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
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
      await login(email.trim(), password);
      // Determine destination: intended previous path or default to /dashboard
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      // Safe user-facing message without exposing credentials or JWT
      setServerError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="auth-card-header">
        <h2 className="auth-card-title">Welcome Back</h2>
        <p className="auth-card-subtitle">
          Sign in to your RicozIngest account to monitor and orchestrate your pipelines.
        </p>
      </div>

      {serverError && (
        <div className="auth-alert-error" role="alert" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{serverError}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* Email Field */}
        <div className="auth-field">
          <label htmlFor="login-email">Email Address</label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <Mail size={16} />
            </span>
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              className={`auth-input ${errors.email ? 'has-error' : ''}`}
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
              }}
              disabled={isSubmitting}
            />
          </div>
          {errors.email && <span className="auth-input-error">{errors.email}</span>}
        </div>

        {/* Password Field */}
        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <Lock size={16} />
            </span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              className={`auth-input ${errors.password ? 'has-error' : ''}`}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
              }}
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <span className="auth-input-error">{errors.password}</span>}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary auth-btn-submit"
          disabled={isSubmitting}
          id="btn-login-submit"
        >
          {isSubmitting ? (
            <>
              <span className="spinner"></span>
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <LogIn size={18} />
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>

      {/* Switch to Register */}
      <div className="auth-switch-prompt">
        Don&apos;t have an account yet?
        <Link to="/register" className="auth-link">
          Create an account
        </Link>
      </div>
    </div>
  );
}

export default LoginPage;
