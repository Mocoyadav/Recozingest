import React, { useEffect } from 'react';
import '../../styles/landing.css';
import LandingNavbar from '../../components/landing/LandingNavbar.jsx';
import HeroSection from '../../components/landing/HeroSection.jsx';
import ValuePropSection from '../../components/landing/ValuePropSection.jsx';
import HowItWorksSection from '../../components/landing/HowItWorksSection.jsx';
import IntegrationsSection from '../../components/landing/IntegrationsSection.jsx';
import TransformationSection from '../../components/landing/TransformationSection.jsx';
import AutomationSection from '../../components/landing/AutomationSection.jsx';
import MonitoringSection from '../../components/landing/MonitoringSection.jsx';
import SecuritySection from '../../components/landing/SecuritySection.jsx';
import CtaSection from '../../components/landing/CtaSection.jsx';
import LandingFooter from '../../components/landing/LandingFooter.jsx';

export function LandingPage() {
  useEffect(() => {
    document.title = 'RicozIngest | Connect, Transform & Deliver Your Data';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="landing-page-root">
      <LandingNavbar />
      <main id="main-content">
        <HeroSection />
        <ValuePropSection />
        <HowItWorksSection />
        <IntegrationsSection />
        <TransformationSection />
        <AutomationSection />
        <MonitoringSection />
        <SecuritySection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}

export default LandingPage;
