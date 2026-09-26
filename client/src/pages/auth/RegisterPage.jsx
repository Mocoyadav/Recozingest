import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';

export function RegisterPage() {
  const { register, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form client-side before submission
  const validate = () => {
    const errs = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      errs.name = 'Full name is required';
    } else if (trimmedName.length < 2) {
      errs.name = 'Name must be at least 2 characters';
    }

    if (!trimmedEmail) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Please provide a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
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
      // 1. Register the new account
      await register(name.trim(), email.trim(), password);

      // 2. Automatically log in with the new credentials for seamless onboarding
      try {
        await login(email.trim(), password);
        navigate('/dashboard', { replace: true });
      } catch {
        // Fallback: If auto-login fails, redirect to /login
        toast.info('Account created! Please sign in with your credentials.');
        navigate('/login', { replace: true });
      }
    } catch (err) {
      // Safe error presentation without exposing credentials
      setServerError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="auth-card-header">
        <h2 className="auth-card-title">Create Account</h2>
        <p className="auth-card-subtitle">
          Start orchestrating robust, schema-aware data pipelines with RicozIngest.
        </p>
      </div>

      {serverError && (
        <div className="auth-alert-error" role="alert" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{serverError}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* Name Field */}
        <div className="auth-field">
          <label htmlFor="reg-name">Full Name</label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <User size={16} />
            </span>
            <input
              id="reg-name"
              type="text"
              name="name"
              autoComplete="name"
              className={`auth-input ${errors.name ? 'has-error' : ''}`}
              placeholder="Alex Morgan"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
              disabled={isSubmitting}
            />
          </div>
          {errors.name && <span className="auth-input-error">{errors.name}</span>}
        </div>

        {/* Email Field */}
        <div className="auth-field">
          <label htmlFor="reg-email">Email Address</label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <Mail size={16} />
            </span>
            <input
              id="reg-email"
              type="email"
              name="email"
              autoComplete="email"
              className={`auth-input ${errors.email ? 'has-error' : ''}`}
              placeholder="alex@company.com"
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
          <label htmlFor="reg-password">Password</label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <Lock size={16} />
            </span>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              className={`auth-input ${errors.password ? 'has-error' : ''}`}
              placeholder="At least 6 characters"
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

        {/* Confirm Password Field */}
        <div className="auth-field">
          <label htmlFor="reg-confirm-password">Confirm Password</label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <Lock size={16} />
            </span>
            <input
              id="reg-confirm-password"
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              className={`auth-input ${errors.confirmPassword ? 'has-error' : ''}`}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: null }));
              }}
              disabled={isSubmitting}
            />
          </div>
          {errors.confirmPassword && (
            <span className="auth-input-error">{errors.confirmPassword}</span>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary auth-btn-submit"
          disabled={isSubmitting}
          id="btn-register-submit"
        >
          {isSubmitting ? (
            <>
              <span className="spinner"></span>
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <UserPlus size={18} />
              <span>Create Account</span>
            </>
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div className="auth-switch-prompt">
        Already have an account?
        <Link to="/login" className="auth-link">
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default RegisterPage;
