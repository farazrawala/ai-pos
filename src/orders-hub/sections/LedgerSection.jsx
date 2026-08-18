import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Button from '../components/Button/Button.jsx';
import Reveal from '../components/Reveal.jsx';
import LedgerMockup from '../components/DashboardPreview/LedgerMockup.jsx';
import { site } from '../config.js';

export default function LedgerSection() {
  return (
    <section className="oh-section" id="ledger">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Accounting"
          title="Know Where Every Rupee Goes."
          description="Receivables, payables, cash, and bank balances sit next to a full debit/credit history."
        />
        <Reveal>
          <LedgerMockup />
        </Reveal>
        <div className="oh-center oh-mt">
          <Button href={site.urls.signup}>Manage Your Ledger</Button>
        </div>
      </div>
    </section>
  );
}
