import { lazy, Suspense } from 'react';
import Navbar from '../components/Navbar/Navbar.jsx';
import Footer from '../components/Footer/Footer.jsx';
import Hero from '../sections/Hero.jsx';

const BusinessTypes = lazy(() => import('../sections/BusinessTypes.jsx'));
const Features = lazy(() => import('../sections/Features.jsx'));
const POSShowcase = lazy(() => import('../sections/POSShowcase.jsx'));
const InventorySection = lazy(() => import('../sections/InventorySection.jsx'));
const LedgerSection = lazy(() => import('../sections/LedgerSection.jsx'));
const ProfitSection = lazy(() => import('../sections/ProfitSection.jsx'));
const InvoiceSection = lazy(() => import('../sections/InvoiceSection.jsx'));
const ReportsSection = lazy(() => import('../sections/ReportsSection.jsx'));
const OnlineStoreSection = lazy(() => import('../sections/OnlineStoreSection.jsx'));
const CustomersSection = lazy(() => import('../sections/CustomersSection.jsx'));
const OfflineSection = lazy(() => import('../sections/OfflineSection.jsx'));
const DashboardSection = lazy(() => import('../sections/DashboardSection.jsx'));
const HowItWorks = lazy(() => import('../sections/HowItWorks.jsx'));
const Pricing = lazy(() => import('../sections/Pricing.jsx'));
const FAQ = lazy(() => import('../sections/FAQ.jsx'));
const FinalCTA = lazy(() => import('../sections/FinalCTA.jsx'));

function SectionFallback() {
  return <div className="oh-section" aria-hidden="true" />;
}

export default function Home() {
  return (
    <>
      <a className="oh-skip" href="#main">
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <Suspense fallback={<SectionFallback />}>
          <BusinessTypes />
          <Features />
          <POSShowcase />
          <InventorySection />
          <LedgerSection />
          <ProfitSection />
          <InvoiceSection />
          <ReportsSection />
          <OnlineStoreSection />
          <CustomersSection />
          <OfflineSection />
          <DashboardSection />
          <HowItWorks />
          <Pricing />
          <FAQ />
          <FinalCTA />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
