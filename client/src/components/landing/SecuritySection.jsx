import React from 'react';
import {
  KeyRound,
  ShieldAlert,
  Lock,
  EyeOff,
  FilterX,
  ShieldCheck
} from 'lucide-react';

const SECURITY_FEATURES = [
  {
    icon: KeyRound,
    title: 'Authentication & Session Guards',
    description: 'Cryptographically signed JWT sessions and secure credential hashing to protect account access.'
  },
  {
    icon: ShieldCheck,
    title: 'Strict Tenant Isolation',
    description: 'Multi-tenant database partitioning ensures organizations only query and execute their own pipelines.'
  },
  {
    icon: Lock,
    title: 'Credential Protection',
    description: 'Sensitive connector credentials and tokens are secured and never exposed in unauthenticated contexts.'
  },
  {
    icon: EyeOff,
    title: 'Write-Only Credential Fields',
    description: 'Database passwords, tokens, and secrets are write-only and never echoed back to client responses.'
  },
  {
    icon: FilterX,
    title: 'Sanitized Error Diagnostics',
    description: 'Execution failure traces automatically redact raw connection strings and sensitive credential parameters.'
  },
  {
    icon: ShieldAlert,
    title: 'Protected Application Routes',
    description: 'Frontend and backend endpoints are guarded by session verification to prevent unauthorized access.'
  }
];

export function SecuritySection() {
  return (
    <section id="security" className="landing-section" aria-labelledby="security-heading">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-section-tag">Security & Reliability</span>
          <h2 id="security-heading" className="landing-section-title">
            Built With Security in Mind
          </h2>
          <p className="landing-section-subtitle">
            Engineered from the ground up to protect enterprise credentials, isolate customer data, and deliver reliable execution.
          </p>
        </div>

        <div className="landing-security-grid">
          {SECURITY_FEATURES.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="landing-security-card">
                <div className="landing-security-icon" aria-hidden="true">
                  <Icon size={20} />
                </div>
                <h3 className="landing-security-title">{item.title}</h3>
                <p className="landing-security-desc">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default SecuritySection;
