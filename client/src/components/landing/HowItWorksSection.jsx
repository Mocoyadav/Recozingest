import React from 'react';
import { Database, GitMerge, SlidersHorizontal, PlayCircle } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    title: 'Connect',
    description: 'Choose and configure your data source.',
    icon: Database
  },
  {
    number: '02',
    title: 'Configure',
    description: 'Select the destination and define the pipeline.',
    icon: GitMerge
  },
  {
    number: '03',
    title: 'Transform',
    description: 'Apply the required data transformations.',
    icon: SlidersHorizontal
  },
  {
    number: '04',
    title: 'Run & Monitor',
    description: 'Execute, schedule and monitor your pipeline.',
    icon: PlayCircle
  }
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="landing-section landing-section-muted" aria-labelledby="how-it-works-heading">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-section-tag">How It Works</span>
          <h2 id="how-it-works-heading" className="landing-section-title">
            From Source to Destination
          </h2>
          <p className="landing-section-subtitle">
            Build a pipeline in a few simple steps.
          </p>
        </div>

        <div className="landing-steps-grid">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="landing-step-card">
                <div className="landing-step-header">
                  <span className="landing-step-number">{step.number}</span>
                  <div className="landing-step-icon" aria-hidden="true">
                    <Icon size={20} />
                  </div>
                </div>
                <h3 className="landing-step-title">{step.title}</h3>
                <p className="landing-step-desc">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default HowItWorksSection;
