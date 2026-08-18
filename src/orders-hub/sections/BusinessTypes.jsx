import {
  Building2,
  Cpu,
  Globe,
  Pill,
  Shirt,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';
import TestimonialCard from '../components/TestimonialCard/TestimonialCard.jsx';
import { businessTypes } from '../data/businessTypes.js';
import { testimonials } from '../data/testimonials.js';

const icons = {
  retail: Store,
  wholesale: Building2,
  supermarkets: ShoppingBag,
  pharmacies: Pill,
  electronics: Cpu,
  fashion: Shirt,
  restaurants: UtensilsCrossed,
  online: Globe,
};

export default function BusinessTypes() {
  return (
    <section className="oh-section" id="business-types">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Who it's for"
          title="Built For Businesses That Move Fast"
          description="Retailers, wholesalers, restaurants, and online sellers run the same platform — without bolting on extra tools."
        />
        <div className="oh-type-grid">
          {businessTypes.map((type, i) => {
            const Icon = icons[type.id] || Store;
            return (
              <Reveal key={type.id} delay={i * 40}>
                <article className="oh-type-card">
                  <span className="oh-icon-wrap">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3>{type.title}</h3>
                  <p>{type.description}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
        <div className="oh-quote-row">
          {testimonials.map((item, i) => (
            <Reveal key={item.name} delay={i * 50}>
              <TestimonialCard {...item} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
