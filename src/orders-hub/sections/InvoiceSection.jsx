import { Check } from 'lucide-react';
import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';
import InvoiceMockup from '../components/DashboardPreview/InvoiceMockup.jsx';

const invoicePoints = [
  'Custom invoices with your numbering',
  'PDF, print, and email in one action',
  'Payment status and partial payments',
  'Due dates your ledger already understands',
];

export default function InvoiceSection() {
  return (
    <section className="oh-section" id="invoices">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Invoices"
          title="Create Professional Invoices In Seconds."
          description="Send a clean invoice from the same system that recorded the sale."
        />
        <div className="oh-split oh-split--invert">
          <Reveal>
            <InvoiceMockup />
          </Reveal>
          <Reveal delay={80}>
            <ul className="oh-feature-list">
              {invoicePoints.map((item) => (
                <li key={item}>
                  <Check size={18} strokeWidth={2.4} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
