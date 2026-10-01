import React from 'react';
import { Database, Sliders, Clock, Activity } from 'lucide-react';

const VALUE_PROPS = [
  {
    icon: Database,
    title: 'Connect',
    description: 'Connect APIs, databases and other supported data sources.'
  },
  {
    icon: Sliders,
    title: 'Transform',
    description: 'Prepare and transform data before it reaches its destination.'
  },
  {
    icon: Clock,
    title: 'Automate',
    description: 'Schedule pipelines and automate recurring data movement.'
  },
  {
    icon: Activity,
    title: 'Monitor',
    description: 'Track pipeline executions, errors and run history from one place.'
  }
];

export function ValuePropSection() {
  return (
    <section id="features" className="landing-section" aria-labelledby="value-prop-heading">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-section-tag">Value Proposition</span>
          <h2 id="value-prop-heading" className="landing-section-title">
            Everything You Need to Move Data
          </h2>
          <p className="landing-section-subtitle">
            Reliable, secure building blocks for connecting heterogeneous data sources, modifying records on the fly, and ensuring delivery.
          </p>
        </div>

        <div className="landing-value-grid">
          {VALUE_PROPS.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={index} className="landing-value-card">
                <div className="landing-value-icon" aria-hidden="true">
                  <Icon size={24} />
                </div>
                <h3 className="landing-value-title">{item.title}</h3>
                <p className="landing-value-desc">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ValuePropSection;
