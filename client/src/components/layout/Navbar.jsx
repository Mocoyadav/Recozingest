import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, ShieldCheck, ChevronDown, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export function Navbar({ onToggleMobileSidebar }) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [dropdownOpen]);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <header className="app-topbar" role="banner">
      {/* Left side: Mobile Menu Toggle & System Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {onToggleMobileSidebar && (
          <button
            type="button"
            className="btn btn-secondary mobile-menu-btn"
            onClick={onToggleMobileSidebar}
            aria-label="Toggle navigation menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              height: '36px',
              width: '36px'
            }}
          >
            <Menu size={18} />
          </button>
        )}

        <div className="topbar-context" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span
            className="badge badge-success"
            style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', textTransform: 'uppercase' }}
          >
            Live Engine
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Pipeline Orchestrator
          </span>
        </div>
      </div>

      {/* Right side: Authenticated User Profile & Dropdown */}
      <div className="topbar-actions" style={{ position: 'relative' }} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="user-profile-button"
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
          id="btn-user-menu"
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 'var(--radius-md)',
            padding: '0.375rem 0.625rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated)';
          }}
          onMouseLeave={(e) => {
            if (!dropdownOpen) {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div className="user-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="user-meta" style={{ textAlign: 'left' }}>
            <span className="user-name">{user?.name || 'Engineer'}</span>
            <span className="user-email">{user?.email || 'authenticated'}</span>
          </div>
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-muted)',
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition-fast)'
            }}
          />
        </button>

        {/* User Dropdown Menu */}
        {dropdownOpen && (
          <div
            className="user-dropdown-menu"
            role="menu"
            aria-label="User Account Menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '260px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              padding: '0.75rem 0',
              zIndex: 100,
              animation: 'toastSlide 150ms ease-out'
            }}
          >
            {/* User Details Header */}
            <div style={{ padding: '0.5rem 1rem 0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {user?.name || 'Authenticated User'}
                </span>
                <span title="Verified Tenant User">
                  <ShieldCheck size={14} color="var(--success)" />
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                {user?.email}
              </p>
              <div style={{ marginTop: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    padding: '0.15rem 0.4rem',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    borderRadius: 'var(--radius-xs)',
                    fontWeight: 600
                  }}
                >
                  Workspace Admin
                </span>
              </div>
            </div>

            {/* Menu Actions */}
            <div style={{ padding: '0.375rem 0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="dropdown-item"
                role="menuitem"
                id="btn-navbar-logout"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8125rem',
                  color: 'var(--danger)',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
