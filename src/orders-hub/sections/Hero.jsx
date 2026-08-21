import { ArrowRight } from 'lucide-react';
import Button from '../components/Button/Button.jsx';
import HeroDashboard from '../components/DashboardPreview/HeroDashboard.jsx';
import { floatingCards } from '../data/mock.js';
import { site } from '../config.js';
import { useSignupModal } from '../context/SignupModalContext.jsx';

export default function Hero() {
  const { openSignup } = useSignupModal();
  return (
    <section className="oh-hero" id="top">
      <div className="oh-container oh-hero__grid">
        <div className="oh-hero__copy">
          <p className="oh-eyebrow">POS · Inventory · Accounting · Online Store</p>
          <h1>Run Your Entire Business From One Place.</h1>
          <p className="oh-lede oh-lede--left">
            Orders Hub gives you everything you need to sell, track inventory, manage finances,
            monitor profits, create invoices, and grow your business — all from one powerful
            platform.
          </p>
          <p className="oh-hero__tag">{site.tagline}</p>
          <div className="oh-hero__cta">
            <Button size="lg" onClick={openSignup}>
              Start Free
            </Button>
            <Button href="#features" variant="ghost" size="lg">
              Explore Features <ArrowRight size={18} />
            </Button>
          </div>
          <p className="oh-hero__proof">{site.coreMessage}</p>
        </div>
        <div className="oh-hero__visual">
          {floatingCards.map((card, i) => (
            <aside key={card.id} className={`oh-float oh-float--${i + 1} oh-float--${card.tone}`}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </aside>
          ))}
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}
