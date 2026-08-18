import { Check } from 'lucide-react';
import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Button from '../components/Button/Button.jsx';
import Reveal from '../components/Reveal.jsx';
import PosMockup from '../components/DashboardPreview/PosMockup.jsx';
import { posHighlights } from '../data/features.js';
import { site } from '../config.js';

export default function POSShowcase() {
  return (
    <section className="oh-section" id="pos">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Point of sale"
          title="Sell Faster With A Smarter POS"
          description="A production-ready checkout for counters that cannot wait: scan, discount, take payment, print."
        />
        <div className="oh-split">
          <Reveal>
            <ul className="oh-feature-list">
              {posHighlights.map((item) => (
                <li key={item}>
                  <Check size={18} strokeWidth={2.4} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <Button href={site.urls.signup} className="oh-mt">
              Explore POS
            </Button>
          </Reveal>
          <Reveal delay={80}>
            <PosMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
