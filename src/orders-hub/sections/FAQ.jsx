import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import { faqs } from '../data/faq.js';

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section className="oh-section" id="faq">
      <div className="oh-container oh-faq-wrap">
        <SectionHeader
          title="Questions, Answered"
          description="The same platform covers POS, inventory, ledgers, invoices, profit, reports, warehouses, and your online store."
        />
        <div className="oh-faq">
          {faqs.map((item, i) => {
            const expanded = open === i;
            return (
              <div key={item.q} className={`oh-faq__item${expanded ? ' is-open' : ''}`}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? -1 : i)}
                  >
                    {item.q}
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                </h3>
                <div className="oh-faq__panel" hidden={!expanded}>
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
