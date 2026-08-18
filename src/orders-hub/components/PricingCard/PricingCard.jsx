import Button from '../Button/Button.jsx';
import { site } from '../../config.js';

export default function PricingCard({ plan }) {
  return (
    <article className={`oh-price-card${plan.featured ? ' is-featured' : ''}`}>
      {plan.featured ? <p className="oh-price-card__badge">Most chosen</p> : null}
      <h3 className="oh-h3">{plan.name}</h3>
      <p className="oh-muted">{plan.blurb}</p>
      <p className="oh-price-card__price">
        <span>{plan.price}</span>
        {plan.period ? <small>{plan.period}</small> : null}
      </p>
      <ul className="oh-price-card__list">
        {plan.features.map((row) => (
          <li key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </li>
        ))}
      </ul>
      <Button href={plan.id === 'enterprise' ? site.urls.demo : site.urls.signup} variant={plan.featured ? 'primary' : 'secondary'}>
        {plan.id === 'enterprise' ? 'Talk to sales' : 'Start Free'}
      </Button>
    </article>
  );
}
