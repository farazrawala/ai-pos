import { useState } from 'react';
import { ledgerKpis, ledgerRows, ledgerTabs } from '../../data/mock.js';
import { formatPKR } from '../../utils/format.js';

export default function LedgerMockup() {
  const [tab, setTab] = useState('Customers');

  return (
    <div className="oh-mock">
      <div className="oh-mock__chrome">
        <span />
        <span />
        <span />
        <p>Orders Hub · Ledger</p>
      </div>
      <div className="oh-kpi-row">
        {ledgerKpis.map((kpi) => (
          <div key={kpi.id} className="oh-kpi">
            <p>{kpi.label}</p>
            <strong>{formatPKR(kpi.value)}</strong>
          </div>
        ))}
      </div>
      <div className="oh-tabs" role="tablist" aria-label="Ledger views">
        {ledgerTabs.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? 'is-active' : ''}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="oh-table-wrap">
        <table className="oh-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map((row) => (
              <tr key={`${row.date}-${row.description}`}>
                <td>{row.date}</td>
                <td>
                  {tab === 'Customers' ? row.description : `${tab} · ${row.description}`}
                </td>
                <td>{row.debit ? formatPKR(row.debit) : '—'}</td>
                <td>{row.credit ? formatPKR(row.credit) : '—'}</td>
                <td>{formatPKR(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
