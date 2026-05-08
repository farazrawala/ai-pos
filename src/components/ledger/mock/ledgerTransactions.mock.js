/**
 * Per-user transaction sets + chart aggregates (mock).
 * Keys match MOCK_LEDGER_USERS ids.
 */

/** @type {Record<string, import('./ledgerTypes.js').LedgerTransaction[]>} */
export const TRANSACTIONS_BY_USER_ID = {
  'lu-001': [
    {
      id: 't1',
      date: '2025-04-01T10:00:00',
      referenceNo: 'OB-2025',
      description: 'Opening balance carry-forward',
      category: 'Adjustment',
      type: 'credit',
      debit: 0,
      credit: 0,
      paymentMethod: 'Journal',
      createdBy: 'System',
      status: 'posted',
      debitAccount: 'Equity',
      creditAccount: 'Ledger control',
    },
    {
      id: 't2',
      date: '2025-04-10T11:20:00',
      referenceNo: 'INV-90211',
      description: 'B2B invoice — textiles',
      category: 'Sales',
      type: 'credit',
      debit: 0,
      credit: 45000,
      paymentMethod: 'On account',
      createdBy: 'Sara Malik',
      status: 'posted',
      notes: 'Net 45 terms.',
      debitAccount: 'AR',
      creditAccount: 'Sales',
      linkedRefs: ['SO-4402'],
      attachments: [{ name: 'inv-90211.pdf' }],
      auditTrail: [{ at: '2025-04-10T11:21:00Z', action: 'Posted', by: 'Sara Malik' }],
    },
    {
      id: 't3',
      date: '2025-04-22T09:30:00',
      referenceNo: 'RCPT-771',
      description: 'Payment received — bank',
      category: 'Receipt',
      type: 'credit',
      debit: 0,
      credit: 32000,
      paymentMethod: 'Bank transfer',
      createdBy: 'Ayesha Khan',
      status: 'posted',
      debitAccount: 'Bank',
      creditAccount: 'AR',
    },
    {
      id: 't4',
      date: '2025-05-02T14:00:00',
      referenceNo: 'EXP-441',
      description: 'Freight charge allocation',
      category: 'Expense',
      type: 'debit',
      debit: 4200,
      credit: 0,
      paymentMethod: 'Journal',
      createdBy: 'System',
      status: 'posted',
      debitAccount: 'Freight expense',
      creditAccount: 'AP',
    },
    {
      id: 't5',
      date: '2025-05-07T14:22:00',
      referenceNo: 'ADJ-009',
      description: 'FX rounding adjustment',
      category: 'Adjustment',
      type: 'credit',
      debit: 0,
      credit: 650.75,
      paymentMethod: 'Journal',
      createdBy: 'Ayesha Khan',
      status: 'posted',
      debitAccount: 'Rounding',
      creditAccount: 'Ledger',
    },
  ],
  'lu-002': [
    {
      id: 'v1',
      date: '2025-04-05T08:00:00',
      referenceNo: 'PO-7788',
      description: 'Stock purchase — packaging',
      category: 'Purchase',
      type: 'debit',
      debit: 45000,
      credit: 0,
      paymentMethod: 'Bank transfer',
      createdBy: 'Bilal Ahmed',
      status: 'posted',
      debitAccount: 'Inventory',
      creditAccount: 'AP',
    },
    {
      id: 'v2',
      date: '2025-05-06T09:10:00',
      referenceNo: 'PAY-221',
      description: 'Partial vendor payment',
      category: 'Payment',
      type: 'credit',
      debit: 0,
      credit: 36549.5,
      paymentMethod: 'Cheque',
      createdBy: 'Finance',
      status: 'posted',
      debitAccount: 'AP',
      creditAccount: 'Bank',
    },
  ],
  'lu-003': [
    {
      id: 'r1',
      date: '2025-05-01T12:00:00',
      referenceNo: 'POS-991',
      description: 'Retail sale',
      category: 'Sales',
      type: 'credit',
      debit: 0,
      credit: 8500,
      paymentMethod: 'Cash',
      createdBy: 'POS-01',
      status: 'posted',
      debitAccount: 'Cash',
      creditAccount: 'Sales',
    },
    {
      id: 'r2',
      date: '2025-05-05T16:40:00',
      referenceNo: 'RET-REF',
      description: 'Customer refund',
      category: 'Returns',
      type: 'debit',
      debit: 2100,
      credit: 0,
      paymentMethod: 'Cash',
      createdBy: 'Sara Malik',
      status: 'posted',
      debitAccount: 'Sales returns',
      creditAccount: 'Cash',
    },
  ],
  'lu-004': [],
  'lu-005': [
    {
      id: 'w1',
      date: '2025-05-07T08:15:00',
      referenceNo: 'INV-WALK',
      description: 'Walk-in purchase on credit',
      category: 'Sales',
      type: 'debit',
      debit: 18200,
      credit: 0,
      paymentMethod: 'On account',
      createdBy: 'POS-02',
      status: 'pending',
      debitAccount: 'AR',
      creditAccount: 'Sales',
    },
    {
      id: 'w2',
      date: '2025-05-07T09:00:00',
      referenceNo: 'DEP-01',
      description: 'Security deposit applied',
      category: 'Deposit',
      type: 'credit',
      debit: 0,
      credit: 1000,
      paymentMethod: 'Cash',
      createdBy: 'Cashier',
      status: 'posted',
      debitAccount: 'Deposit liability',
      creditAccount: 'AR',
    },
  ],
};

/** Monthly debit/credit series for charts (mock). */
export function getMonthlySeriesMock() {
  return {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    debit: [12000, 8500, 14200, 4200, 2100, 9800],
    credit: [28000, 32000, 45000, 36549, 8500, 24000],
  };
}

export function getBalanceTrendMock() {
  return {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    balance: [210000, 245000, 268000, 295000, 312000, 318450],
  };
}

/** Category totals for donut (mock). */
export function getCategoryBreakdownMock() {
  return [
    { label: 'Sales', value: 52 },
    { label: 'Receipts', value: 22 },
    { label: 'Expense', value: 14 },
    { label: 'Adjustment', value: 12 },
  ];
}

/** Weekly activity bars (mock). */
export function getWeeklyActivityMock() {
  return {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [3, 5, 2, 8, 6, 4, 1],
  };
}

/** Timeline events (mock). */
export function getActivityTimelineMock() {
  return [
    { id: 1, at: '2025-05-07T14:22:00', type: 'payment', title: 'Payment received', detail: 'Bank transfer — RCPT-771', by: 'Ayesha Khan' },
    { id: 2, at: '2025-05-06T11:00:00', type: 'invoice', title: 'Invoice generated', detail: 'INV-90211 posted', by: 'Sara Malik' },
    { id: 3, at: '2025-05-05T09:30:00', type: 'adjustment', title: 'Adjustment', detail: 'Freight allocation EXP-441', by: 'System' },
    { id: 4, at: '2025-05-04T16:00:00', type: 'note', title: 'Note added', detail: 'Customer requested statement', by: 'Support' },
  ];
}
