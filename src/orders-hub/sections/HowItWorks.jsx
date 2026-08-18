import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';
import { howItWorks } from '../data/features.js';

export default function HowItWorks() {
  return (
    <section className="oh-section" id="how-it-works">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Onboarding"
          title="Get Started In Minutes"
          description="Create the business, add products, start selling, then let the numbers catch up automatically."
        />
        <ol className="oh-steps">
          {howItWorks.map((step, i) => (
            <Reveal as="li" key={step.step} delay={i * 70} className="oh-step">
              <span className="oh-step__num">{step.step}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
