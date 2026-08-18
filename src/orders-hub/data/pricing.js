/**
 * Pricing is config-driven so live plan limits can be swapped without rewriting cards.
 * Set VITE_ORDERS_HUB_PRICING_JSON to a JSON string if plans are supplied at build time.
 */
const fallbackPlans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'PKR 2,499',
    period: '/ month',
    blurb: 'For a single counter getting off spreadsheets.',
    featured: false,
    features: [
      { label: 'Users', value: '2' },
      { label: 'Products', value: '500' },
      { label: 'Warehouses', value: '1' },
      { label: 'Reports', value: 'Daily + sales' },
      { label: 'Online Store', value: 'Not included' },
      { label: 'Accounting', value: 'Basic ledger' },
      { label: 'Support', value: 'Email' },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 'PKR 6,999',
    period: '/ month',
    blurb: 'For growing retailers who need a store and real accounts.',
    featured: false,
    features: [
      { label: 'Users', value: '8' },
      { label: 'Products', value: '5,000' },
      { label: 'Warehouses', value: '3' },
      { label: 'Reports', value: 'Advanced' },
      { label: 'Online Store', value: 'Included' },
      { label: 'Accounting', value: 'Full ledger' },
      { label: 'Support', value: 'Priority email' },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 'PKR 14,999',
    period: '/ month',
    blurb: 'For multi-location teams that live in the numbers.',
    featured: true,
    features: [
      { label: 'Users', value: '25' },
      { label: 'Products', value: 'Unlimited' },
      { label: 'Warehouses', value: '10' },
      { label: 'Reports', value: 'All + export' },
      { label: 'Online Store', value: 'Branded store' },
      { label: 'Accounting', value: 'Full P&L' },
      { label: 'Support', value: 'Phone + email' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    blurb: 'For groups that need dedicated onboarding and controls.',
    featured: false,
    features: [
      { label: 'Users', value: 'Unlimited' },
      { label: 'Products', value: 'Unlimited' },
      { label: 'Warehouses', value: 'Unlimited' },
      { label: 'Reports', value: 'Custom' },
      { label: 'Online Store', value: 'Multi-store' },
      { label: 'Accounting', value: 'Full + audit' },
      { label: 'Support', value: 'Dedicated' },
    ],
  },
];

function readEnvPlans() {
  const raw = import.meta.env.VITE_ORDERS_HUB_PRICING_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

export const pricingPlans = readEnvPlans() || fallbackPlans;
