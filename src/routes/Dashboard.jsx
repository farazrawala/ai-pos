import { useEffect } from 'react';
import PosDashboardGraphs from '../components/dashboard/PosDashboardGraphs.jsx';
import PosDashboardStatCards from '../components/dashboard/PosDashboardStatCards.jsx';

const Dashboard = () => {
  useEffect(() => {
    const initScrollbar = () => {
      if (window.Scrollbar) {
        try {
          const win = navigator.platform.indexOf('Win') > -1;
          const scrollbarElement = document.querySelector('#sidenav-scrollbar');
          if (win && scrollbarElement) {
            const options = {
              damping: '0.5',
            };
            window.Scrollbar.init(scrollbarElement, options);
          }
        } catch (error) {
          console.error('Scrollbar initialization error:', error);
        }
      }
    };

    // Wait for scripts to load
    const checkAndInit = () => {
      initScrollbar();
    };

    // Try after a delay to ensure scripts are loaded
    const timeoutId = setTimeout(checkAndInit, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      <div className="container-fluid py-4">
        <PosDashboardStatCards />
        <PosDashboardGraphs />
      </div>
    </>
  );
};

export default Dashboard;
