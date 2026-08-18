import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';
import DashboardPreview from '../components/DashboardPreview/DashboardPreview.jsx';

export default function DashboardSection() {
  return (
    <section className="oh-section oh-section--dark" id="dashboard">
      <div className="oh-container">
        <SectionHeader
          light
          eyebrow="Command center"
          title="One Dashboard For The Entire Business."
          description="Sales, orders, profit, customers, low stock, and payments — the same workspace your team opens every morning."
        />
        <Reveal>
          <DashboardPreview />
        </Reveal>
      </div>
    </section>
  );
}
