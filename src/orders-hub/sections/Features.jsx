import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import FeatureCard from '../components/FeatureCard/FeatureCard.jsx';
import Reveal from '../components/Reveal.jsx';
import { coreFeatures } from '../data/features.js';

export default function Features() {
  return (
    <section className="oh-section oh-section--tint" id="features">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Core platform"
          title="Everything You Need To Run Your Business"
          description="POS, inventory, accounting, sales, reports, and an online store — in one system, not six subscriptions."
        />
        <div className="oh-feature-grid">
          {coreFeatures.map((feature, i) => (
            <Reveal key={feature.id} delay={(i % 3) * 60}>
              <FeatureCard {...feature} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
