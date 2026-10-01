import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Workflow, Menu, X, ArrowRight, LayoutDashboard, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export function LandingNavbar() {
  const { isAuthenticated, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleNavClick = (e, targetId) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="landing-navbar-wrapper" role="banner">
      <div className="landing-container">
        <nav className="landing-navbar" role="navigation" aria-label="Main Navigation">
          {/* Logo / Brand Name */}
          <Link to="/" className="landing-brand" aria-label="RicozIngest Home">
            <div className="landing-brand-icon" aria-hidden="true">
              <Workflow size={22} />
            </div>
            <span className="landing-brand-text">
              Ricoz<span className="landing-brand-accent">Ingest</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <ul className="landing-nav-links">
            <li>
              <a
                href="#features"
                className="landing-nav-link"
                onClick={(e) => handleNavClick(e, 'features')}
              >
                Features
              </a>
            </li>
            <li>
              <a
                href="#how-it-works"
                className="landing-nav-link"
                onClick={(e) => handleNavClick(e, 'how-it-works')}
              >
                How It Works
              </a>
            </li>
            <li>
              <a
                href="#integrations"
                className="landing-nav-link"
                onClick={(e) => handleNavClick(e, 'integrations')}
              >
                Integrations
              </a>
            </li>
            <li>
              <a
                href="#security"
                className="landing-nav-link"
                onClick={(e) => handleNavClick(e, 'security')}
              >
                Security
              </a>
            </li>
          </ul>

          {/* Desktop Actions */}
          <div className="landing-nav-actions">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="landing-btn landing-btn-primary"
                id="btn-nav-dashboard"
              >
                <LayoutDashboard size={16} />
                <span>Go to Dashboard</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="landing-btn landing-btn-ghost"
                  id="btn-nav-login"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="landing-btn landing-btn-primary"
                  id="btn-nav-get-started"
                >
                  <span>Get Started</span>
                  <ArrowRight size={16} />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            className="landing-mobile-toggle"
            onClick={() => setMobileMenuOpen(true)}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-menu"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>
        </nav>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="landing-mobile-drawer-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        >
          <div
            id="landing-mobile-menu"
            className="landing-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="landing-mobile-drawer-header">
              <Link
                to="/"
                className="landing-brand"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="RicozIngest Home"
              >
                <div className="landing-brand-icon" aria-hidden="true">
                  <Workflow size={20} />
                </div>
                <span className="landing-brand-text">
                  Ricoz<span className="landing-brand-accent">Ingest</span>
                </span>
              </Link>
              <button
                type="button"
                className="landing-mobile-toggle"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>

            <ul className="landing-mobile-drawer-links">
              <li>
                <a
                  href="#features"
                  className="landing-mobile-nav-link"
                  onClick={(e) => handleNavClick(e, 'features')}
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="landing-mobile-nav-link"
                  onClick={(e) => handleNavClick(e, 'how-it-works')}
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#integrations"
                  className="landing-mobile-nav-link"
                  onClick={(e) => handleNavClick(e, 'integrations')}
                >
                  Integrations
                </a>
              </li>
              <li>
                <a
                  href="#security"
                  className="landing-mobile-nav-link"
                  onClick={(e) => handleNavClick(e, 'security')}
                >
                  Security
                </a>
              </li>
            </ul>

            <div className="landing-mobile-drawer-actions">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="landing-btn landing-btn-primary"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ width: '100%' }}
                >
                  <LayoutDashboard size={18} />
                  <span>Go to Dashboard</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="landing-btn landing-btn-primary"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ width: '100%' }}
                  >
                    <span>Get Started</span>
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    to="/login"
                    className="landing-btn landing-btn-outline"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ width: '100%' }}
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default LandingNavbar;
