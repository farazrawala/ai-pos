import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';
import ReportsMockup from '../components/DashboardPreview/ReportsMockup.jsx';

export default function ReportsSection() {
  return (
    <section className="oh-section oh-section--tint" id="reports">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Daily reports"
          title="Start Every Day With Clear Numbers."
          description="Sales, purchases, expenses, profit, cash, and credit — ready to download or print before the first customer walks in."
        />
        <Reveal>
          <ReportsMockup />
        </Reveal>
      </div>
    </section>
  );
}
