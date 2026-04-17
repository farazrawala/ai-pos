import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';

const MODAL_ID = 'posPaymentModal';

const openPosPaymentModal = () => {
  const el = document.getElementById(MODAL_ID);
  if (el && window.bootstrap?.Modal) {
    const M = window.bootstrap.Modal;
    const instance =
      typeof M.getOrCreateInstance === 'function'
        ? M.getOrCreateInstance(el)
        : M.getInstance(el) || new M(el);
    instance.show();
  }
};

const closePosPaymentModal = () => {
  const el = document.getElementById(MODAL_ID);
  if (el && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getInstance(el)?.hide();
  }
};

/**
 * “Make Payment” dialog — amount, method, balance, change, account, pay actions.
 */
const PosPaymentModal = ({ orderTotal = 0, onPayNow, onPayNowPrint }) => {
  const [amount, setAmount] = useState('0.00');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [account, setAccount] = useState('sales-123456');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodsStatus, setPaymentMethodsStatus] = useState('idle');
  const [paymentMethodsError, setPaymentMethodsError] = useState('');

  const total = Number.isFinite(orderTotal) ? Math.max(0, orderTotal) : 0;
  const selectedPaymentMethod = useMemo(
    () =>
      paymentMethods.find((item) => String(item._id ?? item.id ?? '') === String(paymentMethod)) ||
      null,
    [paymentMethods, paymentMethod]
  );

  const loadPaymentMethods = useCallback(async () => {
    setPaymentMethodsStatus('loading');
    setPaymentMethodsError('');
    try {
      const result = await fetchAccountsRequest({ limit: 2000, skip: 0 });
      const list = Array.isArray(result?.data) ? result.data : [];
      setPaymentMethods(list);
      setPaymentMethodsStatus('succeeded');
      setPaymentMethod((prev) => {
        if (prev && list.some((item) => String(item._id ?? item.id ?? '') === String(prev))) {
          return prev;
        }
        const firstId = list[0]?._id ?? list[0]?.id ?? '';
        return firstId ? String(firstId) : '';
      });
    } catch (error) {
      console.error('[POS] Failed to load payment methods', error);
      setPaymentMethods([]);
      setPaymentMethodsError(error?.message || 'Could not load payment methods');
      setPaymentMethodsStatus('failed');
      setPaymentMethod('');
    }
  }, []);

  const syncAmountFromTotal = useCallback(() => {
    setAmount(total.toFixed(2));
    setPaymentMethod((prev) => {
      if (
        prev &&
        paymentMethods.some((item) => String(item._id ?? item.id ?? '') === String(prev))
      ) {
        return prev;
      }
      const firstId = paymentMethods[0]?._id ?? paymentMethods[0]?.id ?? '';
      return firstId ? String(firstId) : '';
    });
    setAccount('sales-123456');
  }, [paymentMethods, total]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  useEffect(() => {
    const el = document.getElementById(MODAL_ID);
    if (!el) return undefined;
    const onShow = () => syncAmountFromTotal();
    el.addEventListener('show.bs.modal', onShow);
    return () => el.removeEventListener('show.bs.modal', onShow);
  }, [syncAmountFromTotal]);

  const amountNum = parseFloat(String(amount).replace(/,/g, ''));
  const paid = Number.isFinite(amountNum) && amountNum >= 0 ? amountNum : 0;
  const balanceDue = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);

  const handlePayNow = () => {
    onPayNow?.({
      total,
      paid,
      paymentMethod: selectedPaymentMethod?.name || '',
      paymentMethodId: paymentMethod,
      account,
      balanceDue,
      change,
    });
    closePosPaymentModal();
  };

  const handlePayNowPrint = () => {
    onPayNowPrint?.({
      total,
      paid,
      paymentMethod: selectedPaymentMethod?.name || '',
      paymentMethodId: paymentMethod,
      account,
      balanceDue,
      change,
    });
    closePosPaymentModal();
  };

  return (
    <>
      <style>{`
        .pos-payment-modal .pos-pay-hero {
          font-size: 1.75rem;
          font-weight: 700;
          color: #2142d4;
          letter-spacing: 0.02em;
        }
        .pos-payment-modal .pos-pay-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #495057;
          margin-bottom: 0.35rem;
        }
        .pos-payment-modal .pos-pay-balance {
          color: #dc3545;
          font-weight: 600;
        }
        .pos-payment-modal .pos-pay-btn-now {
          background: #2dce89;
          border: none;
          color: #fff;
          font-weight: 600;
          padding: 0.65rem 1rem;
        }
        .pos-payment-modal .pos-pay-btn-now:hover {
          background: #26b87a;
          color: #fff;
        }
        .pos-payment-modal .pos-pay-btn-print {
          background: #11cdef;
          border: none;
          color: #fff;
          font-weight: 600;
          padding: 0.65rem 1rem;
        }
        .pos-payment-modal .pos-pay-btn-print:hover {
          background: #0eb8d6;
          color: #fff;
        }
      `}</style>

      <div
        className="modal fade pos-payment-modal"
        id={MODAL_ID}
        tabIndex="-1"
        aria-labelledby="posPaymentModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header border-bottom py-3">
              <h5 className="modal-title text-secondary fw-semibold mb-0" id="posPaymentModalLabel">
                Make Payment
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body px-4 pb-4 pt-3">
              <p className="text-center pos-pay-hero mb-4">PKR {total.toFixed(2)}</p>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="pos-pay-label d-block" htmlFor="posPayAmount">
                    Amount
                  </label>
                  <input
                    id="posPayAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="pos-pay-label d-block" htmlFor="posPayMethod">
                    Payment Method
                  </label>
                  <select
                    id="posPayMethod"
                    className="form-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={paymentMethodsStatus === 'loading' || paymentMethods.length === 0}
                  >
                    {paymentMethodsStatus === 'loading' && (
                      <option value="">Loading payment methods...</option>
                    )}
                    {paymentMethodsStatus !== 'loading' && paymentMethods.length === 0 && (
                      <option value="">
                        {paymentMethodsError || 'No payment methods available'}
                      </option>
                    )}
                    {paymentMethods.map((method) => {
                      const methodId = String(method._id ?? method.id ?? '');
                      if (!methodId) return null;
                      return (
                        <option key={methodId} value={methodId}>
                          {method.name || 'Unnamed account'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="pos-pay-label d-block" htmlFor="posPayBalance">
                    Balance Due
                  </label>
                  <input
                    id="posPayBalance"
                    type="text"
                    readOnly
                    className="form-control pos-pay-balance bg-light"
                    value={balanceDue.toFixed(2)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="pos-pay-label d-block" htmlFor="posPayChange">
                    Change
                  </label>
                  <input
                    id="posPayChange"
                    type="text"
                    readOnly
                    className="form-control bg-light"
                    value={change.toFixed(2)}
                  />
                </div>
              </div>

              {/* <div className="mb-4">
                <label className="pos-pay-label d-block" htmlFor="posPayAccount">
                  Account
                </label>
                <select
                  id="posPayAccount"
                  className="form-select"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                >
                  <option value="sales-123456">Sales Account / 123456</option>
                  <option value="pos-cash">POS Cash / 789012</option>
                </select>
              </div> */}

              <div className="d-grid gap-2">
                <button
                  type="button"
                  className="btn pos-pay-btn-now rounded-3 d-flex align-items-center justify-content-center gap-2"
                  onClick={handlePayNow}
                >
                  <i className="fas fa-arrow-circle-right"></i>
                  Pay now
                </button>
                {/* <button
                  type="button"
                  className="btn pos-pay-btn-print rounded-3 d-flex align-items-center justify-content-center gap-2"
                  onClick={handlePayNowPrint}
                >
                  <i className="fas fa-print"></i>
                  Pay now + Print
                </button> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PosPaymentModal;
export { openPosPaymentModal, closePosPaymentModal };
