import { ArrowDown } from 'lucide-react';
import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Button from '../components/Button/Button.jsx';
import Reveal from '../components/Reveal.jsx';
import StoreMockup from '../components/DashboardPreview/StoreMockup.jsx';
import { useSignupModal } from '../context/SignupModalContext.jsx';

export default function OnlineStoreSection() {
  const { openSignup } = useSignupModal();
  return (
    <section className="oh-section" id="store">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Online store"
          title="Take Your Business Online."
          description="Your physical store and online store work together. Inventory stays synchronized."
        />
        <div className="oh-split">
          <Reveal>
            <p className="oh-lede oh-lede--left">
              Launch a branded catalog, cart, and checkout without a second stock list. Orders from
              the web hit the same inventory your POS already uses.
            </p>
            <ol className="oh-flow">
              <li>
                <span>POS</span>
                Counter sales in real time
              </li>
              <li aria-hidden="true">
                <ArrowDown size={18} />
              </li>
              <li>
                <span>Orders Hub</span>
                One inventory. One ledger.
              </li>
              <li aria-hidden="true">
                <ArrowDown size={18} />
              </li>
              <li>
                <span>Online Store</span>
                Same products. Same stock.
              </li>
            </ol>
            <Button className="oh-mt" onClick={openSignup}>
              Create Your Online Store
            </Button>
          </Reveal>
          <Reveal delay={80}>
            <StoreMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
