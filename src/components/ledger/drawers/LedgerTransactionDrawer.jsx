import { useEffect } from 'react';
import moment from 'moment';
import { fmtMoney } from '../ledgerUtils.js';

export default function LedgerTransactionDrawer({ row, onClose, onPrint, onPdf, onShare }) {
  useEffect(() => {
    const el = document.getElementById('ledgerTxnDrawer');
    if (!el || !row || !window.bootstrap?.Offcanvas) return undefined;
    const oc = window.bootstrap.Offcanvas.getOrCreateInstance(el);
    const onHidden = () => onClose();
    el.addEventListener('hidden.bs.offcanvas', onHidden);
    const raf = window.requestAnimationFrame(() => {
      try {
        oc.show();
      } catch {
        /* ignore */
      }
    });
    return () => {
      window.cancelAnimationFrame(raf);
      el.removeEventListener('hidden.bs.offcanvas', onHidden);
    };
  }, [row, onClose]);

  if (!row) return null;

  return (
    <div
      className="offcanvas offcanvas-end border-0 shadow-lg"
      tabIndex="-1"
      id="ledgerTxnDrawer"
      aria-labelledby="ledgerTxnDrawerLabel"
      style={{ width: 'min(100%, 440px)' }}
    >
      <div className="offcanvas-header border-bottom">
        <div>
          <h5 className="mb-0" id="ledgerTxnDrawerLabel">
            Transaction
          </h5>
          <p className="text-xs text-muted mb-0 font-weight-bold">{row.referenceNo}</p>
        </div>
        <button type="button" className="btn-close text-dark" data-bs-dismiss="offcanvas" aria-label="Close" />
      </div>
      <div className="offcanvas-body pt-3">
        <dl className="row text-sm mb-0">
          <dt className="col-5 text-muted">ID</dt>
          <dd className="col-7 text-break">{row.id}</dd>
          <dt className="col-5 text-muted">When</dt>
          <dd className="col-7">{moment(row.date).format('DD MMM YYYY, HH:mm')}</dd>
          <dt className="col-5 text-muted">Debit account</dt>
          <dd className="col-7">{row.debitAccount || '—'}</dd>
          <dt className="col-5 text-muted">Credit account</dt>
          <dd className="col-7">{row.creditAccount || '—'}</dd>
          <dt className="col-5 text-muted">Debit</dt>
          <dd className="col-7 text-danger font-weight-bold">{fmtMoney(row.debit)}</dd>
          <dt className="col-5 text-muted">Credit</dt>
          <dd className="col-7 text-success font-weight-bold">{fmtMoney(row.credit)}</dd>
          <dt className="col-5 text-muted">Running balance</dt>
          <dd className={`col-7 font-weight-bold ${row.runningBalance >= 0 ? 'text-success' : 'text-danger'}`}>
            {fmtMoney(row.runningBalance)}
          </dd>
          <dt className="col-5 text-muted">Payment</dt>
          <dd className="col-7">{row.paymentMethod || '—'}</dd>
          <dt className="col-5 text-muted">Created by</dt>
          <dd className="col-7">{row.createdBy}</dd>
        </dl>

        {row.notes ? (
          <div className="mt-3">
            <p className="text-xs font-weight-bold text-muted text-uppercase mb-1">Notes</p>
            <p className="text-sm border rounded p-2 bg-light mb-0">{row.notes}</p>
          </div>
        ) : null}

        {row.linkedRefs?.length ? (
          <div className="mt-3">
            <p className="text-xs font-weight-bold text-muted text-uppercase mb-1">Linked references</p>
            <ul className="list-unstyled text-sm mb-0">
              {row.linkedRefs.map((r) => (
                <li key={r}>
                  <i className="ni ni-tag text-primary me-1" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {row.attachments?.length ? (
          <div className="mt-3">
            <p className="text-xs font-weight-bold text-muted text-uppercase mb-1">Attachments</p>
            <ul className="list-unstyled text-sm mb-0">
              {row.attachments.map((a, i) => (
                <li key={i}>
                  <i className="ni ni-paper-diploma text-secondary me-1" />
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {a.name}
                    </a>
                  ) : (
                    a.name
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {row.auditTrail?.length ? (
          <div className="mt-3">
            <p className="text-xs font-weight-bold text-muted text-uppercase mb-2">Audit trail</p>
            <ul className="list-group list-group-flush">
              {row.auditTrail.map((e, i) => (
                <li key={i} className="list-group-item px-0 py-2 border-0 border-top text-sm">
                  <span className="text-muted text-xs d-block">{moment(e.at).format('DD MMM YYYY HH:mm')}</span>
                  <span className="font-weight-bold">{e.action}</span>
                  <span className="text-muted"> — {e.by}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="d-grid gap-2 mt-4">
          <button type="button" className="btn btn-outline-primary btn-sm mb-0" onClick={() => onPrint(row)}>
            Print
          </button>
          <button type="button" className="btn btn-primary btn-sm mb-0" onClick={() => onPdf(row)}>
            Export PDF
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm mb-0" onClick={() => onShare(row)}>
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
