import { useCallback, useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { fetchUsersRequest } from '../../features/users/usersAPI.js';
import { fetchAccountsByTypeRequest } from '../../features/accounts/accountsAPI.js';
import { paymentReceiptRefId } from '../../features/paymentReceipts/paymentReceiptsAPI.js';
import {
  fetchPaymentReceiptById,
  updatePaymentReceipt,
  clearCurrentReceipt,
  clearReceiptUpdateStatus,
} from '../../features/paymentReceipts/paymentReceiptsSlice.js';

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

function mapReceiptToForm(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  const uid = paymentReceiptRefId(receipt.user ?? receipt.user_id);
  const pmid = paymentReceiptRefId(receipt.payment_mode);
  const amountStr = receipt.amount != null ? String(receipt.amount) : '';
  const dateRaw = receipt.date || receipt.payment_date || receipt.createdAt;
  const paymentDate = dateRaw ? moment(dateRaw).format('YYYY-MM-DD') : todayISO;
  const cq = receipt.cheque_date || receipt.chequeDate;
  return {
    userId: uid,
    paymentMode: pmid,
    paymentType: receipt.payment_type || 'Receive',
    amount: amountStr,
    notes: receipt.description != null ? String(receipt.description) : '',
    paymentDate,
    chequeNumber: String(receipt.cheque_number ?? receipt.chequeNumber ?? ''),
    bankName: String(receipt.bank_name ?? receipt.bankName ?? ''),
    chequeDate: cq ? moment(cq).format('YYYY-MM-DD') : todayISO,
  };
}

export default function PaymentReceiptEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const receiptFromList = location.state?.receipt;

  const {
    currentReceipt,
    receiptFetchStatus,
    receiptFetchError,
    receiptUpdateStatus,
    receiptUpdateError,
  } = useSelector((state) => state.paymentReceipts);

  const { canView, canEdit } = usePermissions('accounts');
  const canSubmit = Boolean(canEdit);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [assetAccounts, setAssetAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [form, setForm] = useState(() => ({
    userId: '',
    paymentMode: '',
    paymentType: 'Receive',
    amount: '',
    notes: '',
    paymentDate: todayISO,
    chequeNumber: '',
    bankName: '',
    chequeDate: todayISO,
  }));
  const [errors, setErrors] = useState({});
  const [hydratedFromList, setHydratedFromList] = useState(false);

  useEffect(() => {
    if (canView === false) navigate('/dashboard');
  }, [canView, navigate]);

  useEffect(() => {
    if (canEdit === false) navigate('/accounts/payment-receipts');
  }, [canEdit, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      try {
        const r = await fetchUsersRequest({ page: 1, limit: 500 });
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

  useEffect(() => {
    if (!id) return;
    dispatch(fetchPaymentReceiptById(id));
    return () => {
      dispatch(clearCurrentReceipt());
      dispatch(clearReceiptUpdateStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (receiptFetchStatus !== 'succeeded' || !currentReceipt) return;
    const mapped = mapReceiptToForm(currentReceipt);
    if (mapped) {
      setForm(mapped);
      setHydratedFromList(false);
    }
  }, [receiptFetchStatus, currentReceipt]);

  useEffect(() => {
    if (receiptFetchStatus !== 'failed') return;
    const from = receiptFromList;
    if (from && String(from._id ?? from.id) === String(id)) {
      const mapped = mapReceiptToForm(from);
      if (mapped) {
        setForm(mapped);
        setHydratedFromList(true);
        toast.warning('Could not load receipt from server; showing data from the list.');
      }
    }
  }, [receiptFetchStatus, receiptFromList, id]);

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
        const accId = String(a._id ?? a.id ?? '');
        const net = accountNetBalance(a);
        return {
          value: accId,
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

  const selectedPaymentAccount = useMemo(
    () => assetAccounts.find((a) => String(a._id ?? a.id ?? '') === String(form.paymentMode)),
    [assetAccounts, form.paymentMode]
  );

  const isSubmitting = receiptUpdateStatus === 'loading';

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!canSubmit) {
        toast.warning('You do not have permission to edit payments.');
        return;
      }
      if (isSubmitting || !id) return;

      const nextErrors = validate();
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;

      const amountNum = parseAmountToNumber(form.amount);
      const payload = {
        user_id: String(form.userId),
        amount: amountNum,
        date: form.paymentDate || todayISO,
        payment_type: form.paymentType,
        payment_mode: String(form.paymentMode),
        description: String(form.notes || '').trim(),
      };

      try {
        await dispatch(updatePaymentReceipt({ receiptId: id, payload })).unwrap();
        toast.success('Payment receipt updated.', { delay: 2500 });
        navigate('/accounts/payment-receipts');
      } catch (err) {
        toast.error(String(err?.message ?? err ?? 'Failed to update'));
      }
    },
    [canSubmit, dispatch, form, id, isSubmitting, validate]
  );

  useEffect(() => {
    if (receiptUpdateError) {
      console.error('[Payment receipt module] Update receipt error', receiptUpdateError);
    }
  }, [receiptUpdateError]);

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

  const txn =
    currentReceipt?.transaction_number ||
    receiptFromList?.transaction_number ||
    '—';

  if (
    id &&
    (receiptFetchStatus === 'idle' || receiptFetchStatus === 'loading')
  ) {
    return (
      <div className="container-fluid py-4">
        <p className="text-sm text-muted mb-0">Loading receipt…</p>
      </div>
    );
  }

  if (receiptFetchStatus === 'failed' && !receiptFromList) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger">{receiptFetchError || 'Failed to load receipt.'}</div>
        <Link to="/accounts/payment-receipts" className="btn btn-sm btn-outline-secondary">
          Back to list
        </Link>
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
              <Link className="text-body" to="/accounts/payment-receipts">
                Payment receipts
              </Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Edit
            </li>
          </ol>
        </nav>

        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h5 className="mb-1 font-weight-bolder">Edit payment receipt</h5>
            <p className="text-sm text-muted mb-0">
              Transaction <span className="font-monospace">{txn}</span>
              {hydratedFromList ? (
                <span className="text-warning ms-2">(offline copy — save may still fail)</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => navigate('/accounts/payment-receipts')}
          >
            Cancel
          </button>
        </div>

        <div className="card border-0 shadow-sm rounded-3 mb-4">
          <div className="card-body p-4">
            <form id="payment-receipt-edit-form" onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-lg-6 col-md-12 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">Select User</label>
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
                  <label className="form-label text-sm font-weight-bold mb-1">Payment Mode</label>
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
                  <FieldError error={errors.paymentMode} />
                </div>

                <div className="col-lg-3 col-md-6 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">Payment Type</label>
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
                  <label className="form-label text-sm font-weight-bold mb-1">Amount</label>
                  <CurrencyPrefixInput
                    value={form.amount}
                    disabled={isSubmitting}
                    onChange={(v) => setForm((p) => ({ ...p, amount: v }))}
                  />
                  <FieldError error={errors.amount} />
                </div>

                <div className="col-lg-3 col-md-6 col-12">
                  <label className="form-label text-sm font-weight-bold mb-1">Date</label>
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
                  <label className="form-label text-sm font-weight-bold mb-1">Notes (optional)</label>
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
                  onClick={() => navigate('/accounts/payment-receipts')}
                >
                  Back to list
                </button>
                <button
                  type="submit"
                  form="payment-receipt-edit-form"
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
                      Update receipt
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
