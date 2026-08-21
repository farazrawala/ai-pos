import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Button from '../components/Button/Button.jsx';
import Reveal from '../components/Reveal.jsx';
import LedgerMockup from '../components/DashboardPreview/LedgerMockup.jsx';
import { useSignupModal } from '../context/SignupModalContext.jsx';

export default function LedgerSection() {
  const { openSignup } = useSignupModal();
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
          <Button onClick={openSignup}>Manage Your Ledger</Button>
        </div>
      </div>
    </section>
  );
}
