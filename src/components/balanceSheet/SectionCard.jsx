import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineItem } from './LineItem.jsx';

const toneProps = {
  assets: {
    border: 'border-success',
    badge: 'bg-success',
    subtotalText: 'text-success',
  },
  liabilities: {
    border: 'border-danger',
    badge: 'bg-danger',
    subtotalText: 'text-danger',
  },
  equity: {
    border: 'border-info',
    badge: 'bg-info',
    subtotalText: 'text-info',
  },
};

/**
 * @param {{
 *   title: string;
 *   tone: 'assets' | 'liabilities' | 'equity';
 *   items: { label: string; amount: number }[];
 *   subtotal: number;
 *   formatCurrency: (n: number) => string;
 *   defaultOpen?: boolean;
 * }} props
 */
export function SectionCard({
  title,
  tone,
  items,
  subtotal,
  formatCurrency,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const t = toneProps[tone];

  return (
    <div className={`card mb-3 shadow-sm border-start border-3 ${t.border}`}>
      <div className="card-header py-3 d-flex justify-content-between align-items-center bg-white">
        <div className="d-flex align-items-center gap-2 min-w-0">
          <span
            className={`rounded-circle flex-shrink-0 ${t.badge}`}
            style={{ width: '8px', height: '8px' }}
            aria-hidden
          />
          <h6 className="mb-0 text-sm font-weight-bold text-truncate">{title}</h6>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary mb-0 flex-shrink-0"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Collapse section' : 'Expand section'}
        >
          <motion.i
            className="fas fa-chevron-down"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="card-body pt-0 pb-3">
              {items.map((row, i) => (
                <LineItem
                  key={`${row.label}-${i}`}
                  label={row.label}
                  amount={row.amount}
                  formatCurrency={formatCurrency}
                />
              ))}
              <div className="d-flex justify-content-between align-items-center border-top pt-3 mt-1">
                <span className={`text-xs text-uppercase font-weight-bold mb-0 ${t.subtotalText}`}>
                  Section subtotal
                </span>
                <span className={`text-sm font-weight-bolder mb-0 ${t.subtotalText}`}>
                  {formatCurrency(subtotal)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
