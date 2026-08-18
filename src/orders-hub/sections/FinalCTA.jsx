import Button from '../components/Button/Button.jsx';
import { site } from '../config.js';

export default function FinalCTA() {
  return (
    <section className="oh-cta" id="get-started">
      <div className="oh-container oh-cta__inner">
        <p className="oh-eyebrow oh-eyebrow--light">{site.coreMessage}</p>
        <h2>Your Business Deserves A Smarter System.</h2>
        <p>Sell faster. Track better. Understand your numbers. Grow with confidence.</p>
        <div className="oh-hero__cta">
          <Button href={site.urls.signup} size="lg">
            Start Free
          </Button>
          <Button href={site.urls.demo} variant="ghost-light" size="lg">
            Book a Demo
          </Button>
        </div>
      </div>
    </section>
  );
}
