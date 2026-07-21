/**
 * Listing tabs above the marketplace product toolbar.
 * `all` — full partner catalog · `me-too` — products already copied to your catalog.
 */
export default function MarketplaceListingTabs({
  activeTab = 'all',
  onChange,
  allCount = 0,
  meTooCount = 0,
  showMeTooTab = true,
}) {
  if (!showMeTooTab) return null;

  const tabs = [
    { id: 'all', label: 'All products', count: allCount },
    { id: 'me-too', label: 'Already Me too', count: meTooCount },
  ];

  return (
    <div className="bc-listing-tabs" role="tablist" aria-label="Product lists">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`bc-listing-tab ${isActive ? 'is-active' : ''}`}
            onClick={() => onChange?.(tab.id)}
          >
            <span className="bc-listing-tab-label">{tab.label}</span>
            <span className="bc-listing-tab-count">{Number(tab.count) || 0}</span>
          </button>
        );
      })}
    </div>
  );
}
