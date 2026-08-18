import { Users, Truck } from 'lucide-react';
import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';

const columns = [
  {
    icon: Users,
    title: 'Customers',
    items: [
      'Customer profiles',
      'Purchase history',
      'Outstanding balance',
      'Customer ledger',
      'Contact information',
      'Loyalty / history',
    ],
  },
  {
    icon: Truck,
    title: 'Suppliers',
    items: [
      'Supplier management',
      'Purchase history',
      'Supplier ledger',
      'Payables',
      'Supplier payments',
    ],
  },
];

export default function CustomersSection() {
  return (
    <section className="oh-section oh-section--tint" id="customers">
      <div className="oh-container">
        <SectionHeader
          eyebrow="People"
          title="Remember Every Customer. Pay Every Supplier."
          description="Balances, history, and contact details live next to the invoices that created them."
        />
        <div className="oh-two">
          {columns.map((col, i) => {
            const Icon = col.icon;
            return (
              <Reveal key={col.title} delay={i * 80}>
                <article className="oh-people-card">
                  <span className="oh-icon-wrap">
                    <Icon size={22} />
                  </span>
                  <h3 className="oh-h3">{col.title}</h3>
                  <ul className="oh-checklist">
                    {col.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
