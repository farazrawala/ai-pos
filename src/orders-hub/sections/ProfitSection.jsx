import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';
import ProfitMockup from '../components/DashboardPreview/ProfitMockup.jsx';

export default function ProfitSection() {
  return (
    <section className="oh-section oh-section--tint" id="profit">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Profit & loss"
          title="See Your Real Business Profit."
          description="Revenue minus cost of goods minus expenses. Charts for every month — not a guess at month-end."
        />
        <Reveal>
          <ProfitMockup />
        </Reveal>
      </div>
    </section>
  );
}
