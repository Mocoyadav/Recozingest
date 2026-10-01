import React from 'react';
import { Link } from 'react-router-dom';
import { Workflow } from 'lucide-react';

export function LandingFooter() {
  const handleScrollTo = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="landing-footer" role="contentinfo" aria-label="Site Footer">
      <div className="landing-container">
        <div className="landing-footer-top">
          {/* Brand Info */}
          <div className="landing-footer-brand-col">
            <Link to="/" className="landing-brand" aria-label="RicozIngest Home">
              <div className="landing-brand-icon" aria-hidden="true">
                <Workflow size={20} />
              </div>
              <span className="landing-brand-text">
                Ricoz<span className="landing-brand-accent">Ingest</span>
              </span>
            </Link>
            <p className="landing-footer-tagline">
              Connect. Transform. Deliver.
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--landing-text-muted)', lineHeight: 1.5, margin: 0 }}>
              Automated data ingestion platform enabling businesses to build, transform, schedule, and monitor pipelines from source to destination.
            </p>
          </div>

          {/* Product Links */}
          <div className="landing-footer-links-col">
            <span className="landing-footer-links-title">Product</span>
            <a
              href="#features"
              className="landing-footer-link"
              onClick={(e) => handleScrollTo(e, 'features')}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="landing-footer-link"
              onClick={(e) => handleScrollTo(e, 'how-it-works')}
            >
              How It Works
            </a>
            <a
              href="#integrations"
              className="landing-footer-link"
              onClick={(e) => handleScrollTo(e, 'integrations')}
            >
              Integrations
            </a>
            <a
              href="#security"
              className="landing-footer-link"
              onClick={(e) => handleScrollTo(e, 'security')}
            >
              Security
            </a>
          </div>

          {/* Account Links */}
          <div className="landing-footer-links-col">
            <span className="landing-footer-links-title">Account</span>
            <Link to="/login" className="landing-footer-link">
              Login
            </Link>
            <Link to="/register" className="landing-footer-link">
              Get Started
            </Link>
            <Link to="/dashboard" className="landing-footer-link">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <span>&copy; 2026 RicozIngest. All rights reserved.</span>
          <span>B2B Data Ingestion &amp; Pipeline Orchestration Platform</span>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;
