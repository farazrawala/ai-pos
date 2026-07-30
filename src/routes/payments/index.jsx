import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from 'moment';
import { Link, useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { fetchUsersRequest } from '../../features/users/usersAPI.js';
import { fetchAccountsByTypeRequest } from '../../features/accounts/accountsAPI.js';
import {
  fetchPaymentReceiptsRequest,
  savePaymentReceiptRequest,
} from '../../features/paymentReceipts/paymentReceiptsAPI.js';
import { formatTransactionCreatedByLabel } from '../../components/ledger/ledgerTransactionMapper.js';

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
  const cleaned = String(raw ?? '')
    .replace(/[^\d.,-]/g, '')
    .replace(/,/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatPKR(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.00';
  return x.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function receiptUserLabel(item) {
  const u = item?.user ?? item?.user_id;
  if (u && typeof u === 'object') return u.name || u.fullName || '—';
  return formatTransactionCreatedByLabel(u) || '—';
}

function receiptPaymentModeLabel(item) {
  const pm = item?.payment_mode;
  if (pm && typeof pm === 'object') return pm.name || '—';
  return formatTransactionCreatedByLabel(pm) || String(pm || '—');
}

function mapReceiptToRecentRow(item) {
  const id = item?._id ?? item?.id;
  return {
    id: String(id || `p_${Date.now()}`),
    transactionNumber: String(item?.transaction_number || item?.transactionNumber || '—'),
    userName: receiptUserLabel(item),
    paymentType: String(item?.payment_type || '—'),
    paymentMode: receiptPaymentModeLabel(item),
    amount: Number(item?.amount ?? 0),
    date: String(item?.date || item?.createdAt || '').slice(0, 10),
    status: String(item?.status || 'posted').toLowerCase(),
    createdAt: item?.createdAt || item?.created_at || item?.date || null,
    updatedAt: item?.updatedAt || item?.updated_at || item?.createdAt || null,
  };
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
  const navigate = useNavigate();
  const { canView, canCreate, canEdit, isAdmin } = usePermissions('payments');
  useRequireModuleAccess('payments');
  const canSubmit = Boolean(canCreate);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [assetAccounts, setAssetAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [localReceiptSearch, setLocalReceiptSearch] = useState('');
  const receiptSearchTimeoutRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRecentLoading(true);
      try {
        const result = await fetchPaymentReceiptsRequest({
          page: 1,
          limit: 10,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
          ...(receiptSearch.trim() ? { search: receiptSearch.trim() } : {}),
        });
        if (cancelled) return;
        const rows = Array.isArray(result?.data) ? result.data : [];
        setRecentPayments(rows.map(mapReceiptToRecentRow));
      } catch (e) {
        if (!cancelled) {
          console.error('[PaymentManagement] Failed to load recent payments', e);
          setRecentPayments([]);
        }
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receiptSearch]);

  useEffect(() => {
    return () => {
      if (receiptSearchTimeoutRef.current) clearTimeout(receiptSearchTimeoutRef.current);
    };
  }, []);

  const handleReceiptSearchChange = useCallback((e) => {
    const value = e.target.value;
    setLocalReceiptSearch(value);
    if (receiptSearchTimeoutRef.current) clearTimeout(receiptSearchTimeoutRef.current);
    receiptSearchTimeoutRef.current = setTimeout(() => {
      setReceiptSearch(value);
    }, 500);
  }, []);

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
        const user = users.find(
          (u) => String(u._id ?? u.id ?? u.userId ?? '') === String(form.userId)
        );
        const amountNum = parseAmountToNumber(form.amount);
        const payAcc = assetAccounts.find(
          (a) => String(a._id ?? a.id ?? '') === String(form.paymentMode)
        );

        const payload = {
          user_id: String(form.userId),
          amount: amountNum,
          date: form.paymentDate || todayISO,
          payment_type: form.paymentType,
          payment_mode: String(form.paymentMode),
          description: String(form.notes || '').trim(),
        };

        const saveUrl = '/api/payment_receipt/save';
        console.log('[PaymentManagement] Submitting payment_receipt/save', {
          url: saveUrl,
          payload,
        });

        const result = await savePaymentReceiptRequest(payload);
        console.log('[PaymentManagement] payment_receipt/save response', result);

        const created =
          result && typeof result === 'object' && !Array.isArray(result)
            ? result.data || result.payment_receipt || result.paymentReceipt || result
            : {};
        const createdId = created?._id ?? created?.id;

        const newRow = mapReceiptToRecentRow({
          ...created,
          _id: createdId,
          payment_type: created.payment_type || form.paymentType,
          payment_mode: payAcc || created.payment_mode,
          user_id: user || created.user_id,
          amount: created.amount ?? amountNum,
          date: created.date || form.paymentDate,
        });

        setRecentPayments((prev) => {
          const withoutDup = prev.filter((row) => row.id !== newRow.id);
          return [newRow, ...withoutDup];
        });
        toast.success('Payment saved successfully.', { delay: 2500 });
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

  if (!isAdmin && canView === false) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-warning mb-0">
          You do not have access to Payment Management.
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="px-3 px-lg-4">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb bg-transparent mb-3 pb-0 pt-1">
            <li className="breadcrumb-item">
              <Link className="text-white opacity-8" to="/">
                Dashboard
              </Link>
            </li>
            <li className="breadcrumb-item">
              <Link className="text-white opacity-8" to="/accounts">
                Accounts
              </Link>
            </li>
            <li className="breadcrumb-item active text-white" aria-current="page">
              Payments
            </li>
          </ol>
        </nav>

        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h3 className="text-white mb-1 font-weight-bolder">Payment Management</h3>
            <p className="text-sm text-white opacity-8 mb-0">
              Record, track and manage customer payments in one place.
            </p>
          </div>
        </div>

        <div className="card border-0 shadow-lg rounded-3 overflow-hidden mb-4">
          <div className="card-header bg-white border-bottom px-4 py-3">
            <div className="d-flex align-items-center">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-gradient-primary text-white me-3"
                style={{ width: 42, height: 42, flexShrink: 0 }}
              >
                <i className="fas fa-wallet" />
              </div>
              <div>
                <h5 className="mb-1">Record a payment</h5>
                <p className="text-sm text-muted mb-0">
                  Enter the payment details below. Fields marked with * are required.
                </p>
              </div>
            </div>
          </div>
          <form id="payment-form" onSubmit={handleSubmit}>
            <div className="card-body p-4">
              <div className="d-flex align-items-center mb-3">
                <span className="text-xs text-uppercase font-weight-bolder text-primary">
                  Payment details
                </span>
                <div className="flex-grow-1 border-top ms-3" />
              </div>
              <div className="row g-3">
                <div className="col-lg-6 col-md-12 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">
                    Select User <span className="text-danger">*</span>
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
                    Payment Mode <span className="text-danger">*</span>
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
                    <div className="text-xs text-warning mt-1">
                      No current-asset accounts found.
                    </div>
                  ) : null}
                  <FieldError error={errors.paymentMode} />
                </div>

                <div className="col-lg-3 col-md-6 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">
                    Payment Type <span className="text-danger">*</span>
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
                    Amount <span className="text-danger">*</span>
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
                    Date <span className="text-danger">*</span>
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
            </div>
            <div className="card-footer bg-light border-top px-4 py-3">
              <div className="d-flex justify-content-end align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary mb-0 px-4"
                  disabled={isSubmitting}
                  onClick={handleCancel}
                >
                  <i className="fas fa-times me-2" />
                  Cancel
                </button>
                <button
                  type="submit"
                  form="payment-form"
                  className="btn btn-sm btn-primary mb-0 px-4"
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
                      <i className="fas fa-check me-2" />
                      Save Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
          <div className="card-header bg-white border-bottom px-4 py-3">
            <div className="row align-items-center g-3">
              <div className="col">
                <h5 className="mb-1">Payment receipts</h5>
                <p className="text-sm text-muted mb-0">Latest payment activity from the server.</p>
              </div>
              <div className="col-12 col-lg-auto">
                <div className="d-flex align-items-center justify-content-lg-end gap-2 flex-wrap flex-sm-nowrap">
                  <div
                    className="input-group input-group-sm flex-nowrap"
                    style={{ width: '260px', maxWidth: '100%' }}
                  >
                  <span className="input-group-text text-body">
                    <SearchInputIcon />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search receipts..."
                    value={localReceiptSearch}
                    onChange={handleReceiptSearchChange}
                    aria-label="Search payment receipts"
                  />
                    {localReceiptSearch ? (
                      <button
                        type="button"
                        className="btn btn-outline-secondary mb-0 px-3"
                        title="Clear search"
                        aria-label="Clear receipt search"
                        onClick={() => {
                          if (receiptSearchTimeoutRef.current) {
                            clearTimeout(receiptSearchTimeoutRef.current);
                          }
                          setLocalReceiptSearch('');
                          setReceiptSearch('');
                        }}
                      >
                        <i className="fas fa-times" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="list-data-table border-0 rounded-0 mx-0 mb-0">
              <div className="list-data-table-scroll">
                <table className="table table-hover align-items-center mb-0">
                <thead>
                  <tr>
                    <th className="ps-4 text-nowrap">S.No</th>
                    <th className="text-nowrap">Transaction #</th>
                    <th className="text-end text-nowrap">Amount</th>
                    <th className="text-nowrap">Type</th>
                    <th className="text-nowrap">Payment mode</th>
                    <th className="text-nowrap">User</th>
                    <th className="text-nowrap">Created</th>
                    <th className="text-nowrap">Last updated</th>
                    <th className="text-nowrap">Status</th>
                    <th className="text-end pe-4 text-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLoading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-5 text-muted">
                        <span className="spinner-border spinner-border-sm text-primary me-2" />
                        <span className="text-sm">Loading payment receipts…</span>
                      </td>
                    </tr>
                  ) : recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-5 text-muted">
                        <i className="fas fa-receipt d-block mb-2 fs-5 opacity-6" />
                        <p className="mb-0 text-sm">
                          {receiptSearch.trim()
                            ? 'No receipts match your search.'
                            : 'No payment receipts recorded yet.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    recentPayments.map((r, index) => (
                      <tr key={r.id}>
                        <td className="ps-4 text-sm text-secondary">{index + 1}</td>
                        <td className="text-sm font-monospace text-dark">
                          {r.transactionNumber}
                        </td>
                        <td className="text-end text-sm font-weight-bold text-dark">
                          PKR {formatPKR(r.amount ?? 0)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              r.paymentType.toLowerCase() === 'receive'
                                ? 'bg-gradient-info'
                                : 'bg-gradient-warning'
                            }`}
                          >
                            {r.paymentType}
                          </span>
                        </td>
                        <td className="text-sm">{r.paymentMode}</td>
                        <td className="text-sm font-weight-bold">{r.userName}</td>
                        <td className="text-sm text-muted text-nowrap">
                          {r.createdAt ? moment(r.createdAt).format('YYYY-MM-DD HH:mm') : r.date || '—'}
                        </td>
                        <td
                          className="text-sm text-muted text-nowrap"
                          title={
                            r.updatedAt
                              ? moment(r.updatedAt).format('MM-DD-YYYY h:mm a')
                              : undefined
                          }
                        >
                          {r.updatedAt ? moment(r.updatedAt).fromNow() : '—'}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              r.status === 'posted' || r.status === 'active'
                                ? 'bg-gradient-success'
                                : r.status === 'pending'
                                  ? 'bg-gradient-warning'
                                  : 'bg-gradient-secondary'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="text-end pe-4">
                          {canEdit || isAdmin ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary mb-0 px-3"
                              onClick={() => navigate(`/payment-receipts/edit/${r.id}`)}
                            >
                              <i className="fas fa-pen me-2" />
                              Edit
                            </button>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                </table>
              </div>
            </div>
            {!recentLoading && recentPayments.length > 0 ? (
              <div className="d-flex justify-content-between align-items-center border-top px-4 py-3">
                <span className="text-xs text-muted">
                  Showing {recentPayments.length}{' '}
                  {receiptSearch.trim() ? 'matching' : 'latest'}{' '}
                  {recentPayments.length === 1 ? 'receipt' : 'receipts'}
                </span>
                <span className="text-xs text-muted">Sorted by most recently updated</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
