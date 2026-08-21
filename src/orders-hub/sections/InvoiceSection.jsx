import { Check } from 'lucide-react';
import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';
import InvoiceMockup from '../components/DashboardPreview/InvoiceMockup.jsx';
import ThermalInvoiceMockup from '../components/DashboardPreview/ThermalInvoiceMockup.jsx';
import A4InvoiceMockup from '../components/DashboardPreview/A4InvoiceMockup.jsx';

const invoicePoints = [
  'Custom invoices with your numbering',
  'Thermal receipt printing for the counter',
  'A4 / PDF invoices for customers and accounts',
  'Payment status and partial payments',
];

export default function InvoiceSection() {
  return (
    <section className="oh-section" id="invoices">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Invoices"
          title="Create Professional Invoices In Seconds."
          description="Thermal receipts, A4 invoices, and digital copies — from the same sale."
        />
        <Reveal>
          <div className="oh-invoice-gallery">
            <ThermalInvoiceMockup />
            <InvoiceMockup />
            <A4InvoiceMockup />
          </div>
        </Reveal>
        <Reveal delay={80}>
          <ul className="oh-feature-list oh-feature-list--row oh-mt">
            {invoicePoints.map((item) => (
              <li key={item}>
                <Check size={18} strokeWidth={2.4} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
