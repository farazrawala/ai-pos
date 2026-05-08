import { useCallback, useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import { Link } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { fetchUsersRequest } from '../../features/users/usersAPI.js';
import { fetchAccountsByTypeRequest } from '../../features/accounts/accountsAPI.js';

const todayISO = moment().format('YYYY-MM-DD');

function isChequePaymentAccount(account) {
  if (!account) return false;
  return /cheque/i.test(String(account.name || ''));
}

function accountNetBalance(a) {
  const ts = a?.transactions_sum;
  if (ts && ts.net_debit_minus_credit != null) return Number(ts.net_debit_minus_credit);
  const ib = a?.initial_balance ?? a?.initialBalance;
  return Number(ib) || 0;
}

function parseAmountToNumber(raw) {
  const cleaned = String(raw ?? '').replace(/[^\d.,-]/g, '').replace(/,/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatPKR(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.00';
  return x.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CurrencyPrefixInput({ value, onChange, disabled }) {
  return (
    <div className="input-group">
      <span className="input-group-text bg-transparent text-body">
        <i className="ni ni-money-coins text-primary me-1" />
        PKR
      </span>
      <input
        type="text"
        className="form-control"
        placeholder="0.00"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.,]/g, '');
          onChange(next);
        }}
      />
    </div>
  );
}

function FieldError({ error }) {
  if (!error) return null;
  return <div className="text-danger text-xs mt-1">{error}</div>;
}

export default function PaymentManagementPage() {
  const { canView, canCreate } = usePermissions('accounts');
  const canSubmit = Boolean(canCreate);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [assetAccounts, setAssetAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [recentPayments, setRecentPayments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      try {
        const r = await fetchUsersRequest({ skip: 0, limit: 10 });
        if (cancelled) return;
        setUsers(Array.isArray(r?.data) ? r.data : []);
      } catch (e) {
        if (!cancelled) {
          toast.error(e?.message || 'Failed to load users');
          setUsers([]);
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAccountsLoading(true);
      try {
        const list = await fetchAccountsByTypeRequest('current_asset');
        if (cancelled) return;
        setAssetAccounts(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) {
          toast.error(e?.message || 'Failed to load payment accounts');
          setAssetAccounts([]);
        }
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const userOptions = useMemo(
    () =>
      users.map((u) => {
        const amount = u.initial_balance ?? u.initialBalance ?? 0;
        return {
          value: String(u._id ?? u.id ?? u.userId ?? ''),
          label: u.name || u.fullName || '—',
          subLabel: `${u.email || '—'} • ${u.phone || '—'} • Amount: PKR ${formatPKR(amount)}`,
        };
      }),
    [users]
  );

  const paymentModeOptions = useMemo(
    () =>
      assetAccounts.map((a) => {
        const id = String(a._id ?? a.id ?? '');
        const net = accountNetBalance(a);
        return {
          value: id,
          label: a.name || '—',
          subLabel: `Net: PKR ${formatPKR(net)} • ${a.transaction_number || a.transactionNumber || '—'}`,
        };
      }),
    [assetAccounts]
  );

  const paymentTypeOptions = useMemo(
    () => [
      { value: 'Send', label: 'Send' },
      { value: 'Receive', label: 'Receive' },
    ],
    []
  );

  const defaultForm = useMemo(
    () => ({
      userId: '',
      paymentMode: '',
      paymentType: 'Receive',
      amount: '',
      notes: '',
      paymentDate: todayISO,
      chequeNumber: '',
      bankName: '',
      chequeDate: todayISO,
    }),
    []
  );

  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  const validate = useCallback(() => {
    const next = {};

    if (!String(form.userId || '').trim()) next.userId = 'Select a user.';
    if (!String(form.paymentMode || '').trim()) next.paymentMode = 'Payment mode is required.';
    if (!String(form.paymentType || '').trim()) next.paymentType = 'Payment type is required.';

    const amountNum = parseAmountToNumber(form.amount);
    if (!amountNum || amountNum <= 0) next.amount = 'Enter a valid amount.';

    if (!String(form.paymentDate || '').trim()) next.paymentDate = 'Select a payment date.';

    const payAcc = assetAccounts.find(
      (a) => String(a._id ?? a.id ?? '') === String(form.paymentMode)
    );
    if (isChequePaymentAccount(payAcc)) {
      if (!String(form.chequeNumber || '').trim()) next.chequeNumber = 'Cheque number is required.';
      if (!String(form.bankName || '').trim()) next.bankName = 'Bank name is required.';
      if (!String(form.chequeDate || '').trim()) next.chequeDate = 'Cheque date is required.';
    }

    return next;
  }, [form, assetAccounts]);

  const handleCancel = useCallback(() => {
    setErrors({});
    setForm(defaultForm);
  }, [defaultForm]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!canSubmit) {
        toast.warning('You do not have permission to save payments.');
        return;
      }
      if (isSubmitting) return;

      const nextErrors = validate();
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;

      setIsSubmitting(true);
      try {
        // Replace with real API call when wired up.
        await new Promise((r) => setTimeout(r, 800));

        const user = users.find((u) => String(u._id ?? u.id ?? u.userId ?? '') === String(form.userId));
        const amountNum = parseAmountToNumber(form.amount);
        const payAcc = assetAccounts.find(
          (a) => String(a._id ?? a.id ?? '') === String(form.paymentMode)
        );

        const newRow = {
          id: `p_${Date.now()}`,
          userName: user?.name || user?.fullName || '—',
          paymentType: form.paymentType,
          paymentMode: payAcc?.name || form.paymentMode || '—',
          amount: amountNum,
          date: form.paymentDate,
          status: 'posted',
        };

        setRecentPayments((prev) => [newRow, ...prev]);
        toast.success('Payment saved (demo).', { delay: 2500 });
        handleCancel();
      } catch (err) {
        toast.error(String(err?.message ?? 'Failed to save payment'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [assetAccounts, canSubmit, form, handleCancel, isSubmitting, users, validate]
  );

  const selectedPaymentAccount = useMemo(
    () => assetAccounts.find((a) => String(a._id ?? a.id ?? '') === String(form.paymentMode)),
    [assetAccounts, form.paymentMode]
  );

  const PaymentChequeFields = isChequePaymentAccount(selectedPaymentAccount) ? (
    <>
      <div className="col-lg-4 col-md-6 col-12">
        <label className="form-label text-sm font-weight-bold mb-1">Cheque Number</label>
        <div className="input-group">
          <span className="input-group-text bg-transparent text-body">
            <i className="ni ni-badge text-primary me-1" />
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Enter cheque number"
            disabled={isSubmitting}
            value={form.chequeNumber}
            onChange={(e) => setForm((p) => ({ ...p, chequeNumber: e.target.value }))}
          />
        </div>
        <FieldError error={errors.chequeNumber} />
      </div>

      <div className="col-lg-4 col-md-6 col-12">
        <label className="form-label text-sm font-weight-bold mb-1">Bank Name</label>
        <div className="input-group">
          <span className="input-group-text bg-transparent text-body">
            <i className="ni ni-building text-primary me-1" />
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Enter bank name"
            disabled={isSubmitting}
            value={form.bankName}
            onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
          />
        </div>
        <FieldError error={errors.bankName} />
      </div>

      <div className="col-lg-4 col-md-6 col-12">
        <label className="form-label text-sm font-weight-bold mb-1">Cheque Date</label>
        <div className="input-group">
          <span className="input-group-text bg-transparent text-body">
            <i className="ni ni-calendar-grid-58 text-primary me-1" />
          </span>
          <input
            type="date"
            className="form-control"
            disabled={isSubmitting}
            value={form.chequeDate}
            onChange={(e) => setForm((p) => ({ ...p, chequeDate: e.target.value }))}
          />
        </div>
        <FieldError error={errors.chequeDate} />
      </div>
    </>
  ) : null;

  if (canView === false) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-warning mb-0">You do not have access to Payment Management.</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="px-3 px-lg-4">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb bg-transparent mb-3 pb-0 pt-1">
            <li className="breadcrumb-item">
              <Link className="text-body" to="/">
                Dashboard
              </Link>
            </li>
            <li className="breadcrumb-item">
              <Link className="text-body" to="/accounts">
                Accounts
              </Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Payments
            </li>
          </ol>
        </nav>

        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h5 className="mb-1 font-weight-bolder">Payment Management</h5>
            <p className="text-sm text-muted mb-0">
              Record receipts and payments with optional cheque details.
            </p>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-3 mb-4">
          <div className="card-body p-4">
            <form id="payment-form" onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-lg-6 col-md-12 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">
                    Select User
                  </label>
                  <SearchableSelect
                    options={userOptions}
                    value={form.userId}
                    placeholder="Choose user"
                    disabled={isSubmitting || usersLoading}
                    onChange={(v) => setForm((p) => ({ ...p, userId: v }))}
                  />
                  <FieldError error={errors.userId} />
                </div>

                <div className="col-lg-3 col-md-6 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">
                    Payment Mode
                  </label>
                  <SearchableSelect
                    options={paymentModeOptions}
                    value={form.paymentMode}
                    placeholder="Choose account"
                    disabled={isSubmitting || accountsLoading}
                    onChange={(v) => {
                      setForm((p) => ({ ...p, paymentMode: v }));
                      const nextAcc = assetAccounts.find(
                        (a) => String(a._id ?? a.id ?? '') === String(v)
                      );
                      if (!isChequePaymentAccount(nextAcc)) {
                        setErrors((prev) => ({
                          ...prev,
                          chequeNumber: undefined,
                          bankName: undefined,
                          chequeDate: undefined,
                        }));
                      }
                    }}
                  />
                  {accountsLoading ? (
                    <div className="text-xs text-muted mt-1">Loading accounts…</div>
                  ) : null}
                  {!accountsLoading && assetAccounts.length === 0 ? (
                    <div className="text-xs text-warning mt-1">No current-asset accounts found.</div>
                  ) : null}
                  <FieldError error={errors.paymentMode} />
                </div>

                <div className="col-lg-3 col-md-6 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">
                    Payment Type
                  </label>
                  <select
                    className="form-select"
                    disabled={isSubmitting}
                    value={form.paymentType}
                    onChange={(e) => setForm((p) => ({ ...p, paymentType: e.target.value }))}
                  >
                    {paymentTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <FieldError error={errors.paymentType} />
                </div>

                <div className="col-lg-3 col-md-6 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">
                    Amount
                  </label>
                  <CurrencyPrefixInput
                    value={form.amount}
                    disabled={isSubmitting}
                    onChange={(v) => setForm((p) => ({ ...p, amount: v }))}
                  />
                  <FieldError error={errors.amount} />
                </div>

                <div className="col-lg-3 col-md-6 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">
                    Date
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent text-body">
                      <i className="ni ni-calendar-grid-58 text-primary me-1" />
                    </span>
                    <input
                      type="date"
                      className="form-control"
                      disabled={isSubmitting}
                      value={form.paymentDate}
                      onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))}
                    />
                  </div>
                  <FieldError error={errors.paymentDate} />
                </div>

                <div className="col-lg-6 col-md-12 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Add remarks (optional)"
                    disabled={isSubmitting}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>

                {PaymentChequeFields}
              </div>

              {errors.submit ? (
                <div className="alert alert-danger mt-3 mb-0" role="alert">
                  {errors.submit}
                </div>
              ) : null}

              <div className="d-flex justify-content-end gap-2 mt-4 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={isSubmitting}
                  onClick={handleCancel}
                >
                  <i className="fas fa-times me-1" />
                  Cancel
                </button>
                <button
                  type="submit"
                  form="payment-form"
                  className="btn btn-sm btn-primary"
                  disabled={isSubmitting || !canSubmit}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-1"
                        role="status"
                        aria-hidden="true"
                      />
                      Saving…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save me-1" />
                      Save Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-3">
          <div className="card-header pb-0">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h6 className="mb-0">Recent transactions</h6>
                <p className="text-xs text-muted mb-0">Latest payments recorded (demo)</p>
              </div>
            </div>
          </div>
          <div className="card-body px-0 pt-0 pb-3">
            <div className="table-responsive">
              <table className="table table-flush table-hover table-sm align-middle mb-0">
                <thead className="thead-light">
                  <tr>
                    <th>User</th>
                    <th>Payment Type</th>
                    <th>Payment Mode</th>
                    <th className="text-end">Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        <p className="mb-0 text-sm">No payments recorded yet.</p>
                      </td>
                    </tr>
                  ) : (
                    recentPayments.map((r) => (
                      <tr key={r.id}>
                        <td className="text-sm font-weight-bold">{r.userName}</td>
                        <td className="text-sm">{r.paymentType}</td>
                        <td className="text-sm">{r.paymentMode}</td>
                        <td className="text-end text-sm font-weight-bold">
                          {formatPKR(r.amount ?? 0)}
                        </td>
                        <td className="text-sm text-muted">{r.date}</td>
                        <td>
                          <span
                            className={`badge text-xs ${
                              r.status === 'posted'
                                ? 'bg-gradient-success text-white'
                                : r.status === 'pending'
                                  ? 'bg-gradient-warning text-white'
                                  : 'bg-gradient-secondary text-white'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

