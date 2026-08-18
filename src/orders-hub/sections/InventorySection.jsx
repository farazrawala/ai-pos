import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';
import InventoryMockup from '../components/DashboardPreview/InventoryMockup.jsx';

export default function InventorySection() {
  return (
    <section className="oh-section oh-section--tint" id="inventory">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Inventory"
          title="Know Exactly What You Have, And Where It Is."
          description="Stock, variants, warehouses, and reorder points stay in one ledger — not a pile of sheets."
        />
        <Reveal>
          <InventoryMockup />
        </Reveal>
      </div>
    </section>
  );
}
