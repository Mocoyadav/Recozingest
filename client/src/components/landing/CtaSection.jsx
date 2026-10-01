import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export function CtaSection() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="landing-section" aria-labelledby="cta-heading" style={{ paddingTop: '2rem' }}>
      <div className="landing-container">
        <div className="landing-cta-banner">
          <div className="landing-cta-content">
            <h2 id="cta-heading" className="landing-cta-title">
              Start Building Your Data Pipelines
            </h2>
            <p className="landing-cta-text">
              Connect your sources, configure your destinations, and manage your data workflows from one place.
            </p>
            <div className="landing-cta-buttons">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="landing-btn landing-btn-primary landing-btn-lg"
                  id="cta-bottom-dashboard"
                >
                  <LayoutDashboard size={18} />
                  <span>Go to Dashboard</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="landing-btn landing-btn-primary landing-btn-lg"
                    id="cta-bottom-register"
                  >
                    <span>Get Started</span>
                    <ArrowRight size={18} />
                  </Link>
                  <Link
                    to="/login"
                    className="landing-btn landing-btn-outline landing-btn-lg"
                    id="cta-bottom-login"
                  >
                    <span>Login</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CtaSection;
