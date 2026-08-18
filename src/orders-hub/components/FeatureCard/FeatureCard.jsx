import { Check } from 'lucide-react';

export default function FeatureCard({ title, description, items = [], href, cta, formula }) {
  return (
    <article className="oh-feature-card">
      <h3 className="oh-h3">{title}</h3>
      <p className="oh-muted">{description}</p>
      {formula ? (
        <div className="oh-formula" aria-label="Profit formula">
          <span>Revenue</span>
          <span className="oh-formula__op">−</span>
          <span>Cost of Goods</span>
          <span className="oh-formula__op">−</span>
          <span>Expenses</span>
          <span className="oh-formula__op">=</span>
          <span className="oh-formula__result">Net Profit</span>
        </div>
      ) : null}
      <ul className="oh-checklist">
        {items.map((item) => (
          <li key={item}>
            <Check size={16} strokeWidth={2.4} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {cta && href ? (
        <a className="oh-text-link" href={href}>
          {cta}
        </a>
      ) : null}
    </article>
  );
}
