import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import PricingCard from '../components/PricingCard/PricingCard.jsx';
import Reveal from '../components/Reveal.jsx';
import { pricingPlans } from '../data/pricing.js';

export default function Pricing() {
  return (
    <section className="oh-section oh-section--tint" id="pricing">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Plans"
          title="Simple Pricing For Growing Teams"
          description="Start free. Scale users, warehouses, and accounting as the business grows."
        />
        <div className="oh-price-grid">
          {pricingPlans.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 50}>
              <PricingCard plan={plan} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
