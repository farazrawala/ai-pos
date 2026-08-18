import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';
import WarehouseMockup from '../components/DashboardPreview/WarehouseMockup.jsx';

export default function WarehouseSection() {
  return (
    <section className="oh-section" id="warehouse">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Multi-warehouse"
          title="Run Stock Across Locations — Without Spreadsheets."
          description="Warehouse inventory, transfers, and reports stay at location level, then roll up to the business."
        />
        <Reveal>
          <WarehouseMockup />
        </Reveal>
      </div>
    </section>
  );
}
