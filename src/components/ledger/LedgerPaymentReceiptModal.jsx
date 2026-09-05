import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import moment from 'moment';
import AppModal from '../AppModal.jsx';
import SearchableSelect from '../common/SearchableSelect.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';
import { buildApiUrl } from '../../config/apiConfig.js';
import { DEBUG } from '../../config/env.js';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import { fetchUsersRequest } from '../../features/users/usersAPI.js';
import {
  buildFetchAccountsByTypeUrl,
  fetchAccountsByTypeRequest,
} from '../../features/accounts/accountsAPI.js';
import { savePaymentReceiptRequest } from '../../features/paymentReceipts/paymentReceiptsAPI.js';
import { buildAmountTransferAccountFilterParams } from '../../features/amountTransfers/amountTransfersAPI.js';
import '../common/devApiSources.css';

const todayISO = () => moment().format('YYYY-MM-DD');

function isChequePaymentAccount(account) {
  if (!account) return false;
  return /cheque/i.test(String(account.name || ''));
}

function parseAmountToNumber(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[^\d.,-]/g, '')
    .replace(/,/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function FieldError({ error }) {
  if (!error) return null;
  return <div className="text-danger text-xs mt-1">{error}</div>;
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

function buildDefaultForm(userId = '') {
  return {
    userId: String(userId || ''),
    paymentMode: '',
    paymentType: 'Receive',
    amount: '',
    notes: '',
    paymentDate: todayISO(),
    chequeNumber: '',
    bankName: '',
    chequeDate: todayISO(),
  };
}

/**
 * Record a send/receive payment for the current ledger user (same fields as /payments).
 */
export default function LedgerPaymentReceiptModal({ open, onClose, user, onSaved }) {
  const { canCreate, isAdmin } = usePermissions('payments');
  const canSubmit = Boolean(canCreate || isAdmin);
  const presetUserId = String(user?.id || '');
  const authUser = useSelector((state) => state.user.user);
  const authCompany = useSelector((state) => state.user.company);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [assetAccounts, setAssetAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountFilterParams, setAccountFilterParams] = useState({ account_type: 'current_asset' });
  const [form, setForm] = useState(() => buildDefaultForm(presetUserId));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSaveError('');
    setIsSubmitting(false);
    setForm(buildDefaultForm(presetUserId));
  }, [open, presetUserId]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      try {
        const r = await fetchUsersRequest({ skip: 0, limit: 50 });
        if (cancelled) return;
        const list = Array.isArray(r?.data) ? r.data : [];
        const hasPreset = list.some(
          (u) => String(u._id ?? u.id ?? u.userId ?? '') === presetUserId
        );
        if (presetUserId && !hasPreset && user) {
          list.unshift({
            _id: presetUserId,
            name: user.fullName,
            email: user.email,
            phone: user.phone,
            initial_balance: user.currentBalance ?? user.openingBalance ?? 0,
          });
        }
        setUsers(list);
      } catch (e) {
        if (!cancelled) {
          toast.error(e?.message || 'Failed to load users');
          setUsers(
            presetUserId && user
              ? [
                  {
                    _id: presetUserId,
                    name: user.fullName,
                    email: user.email,
                    phone: user.phone,
                    initial_balance: user.currentBalance ?? user.openingBalance ?? 0,
                  },
                ]
              : []
          );
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, presetUserId, user]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setAccountsLoading(true);
      try {
        const filters = await buildAmountTransferAccountFilterParams(authUser, authCompany);
        if (cancelled) return;
        setAccountFilterParams(filters);
        const list = await fetchAccountsByTypeRequest(filters.account_type, {
          exclude_id: filters.exclude_id,
        });
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
  }, [open, authUser, authCompany]);

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: String(u._id ?? u.id ?? u.userId ?? ''),
        label: u.name || u.fullName || '—',
        subLabel: u.phone ? String(u.phone) : '',
      })),
    [users]
  );

  const paymentModeOptions = useMemo(
    () =>
      assetAccounts.map((a) => ({
        value: String(a._id ?? a.id ?? ''),
        label: a.name || '—',
      })),
    [assetAccounts]
  );

  const selectedPaymentAccount = useMemo(
    () => assetAccounts.find((a) => String(a._id ?? a.id ?? '') === String(form.paymentMode)),
    [assetAccounts, form.paymentMode]
  );

  const apiSources = useMemo(() => {
    if (!DEBUG) return [];
    return [
      {
        key: 'users',
        label: 'Users',
        url: buildApiUrl('user/get-all-active?include_inactive=true&skip=0&limit=50'),
        status: usersLoading ? 'loading' : 'success',
        error: null,
      },
      {
        key: 'accounts',
        label: 'Payment accounts',
        url: buildFetchAccountsByTypeUrl(accountFilterParams.account_type || 'current_asset', {
          exclude_id: accountFilterParams.exclude_id,
        }),
        status: accountsLoading ? 'loading' : 'success',
        error: null,
      },
      {
        key: 'save-payment',
        label: 'Save payment (POST)',
        url: buildApiUrl('payment_receipt/save'),
        status: isSubmitting ? 'loading' : saveError ? 'error' : 'pending',
        error: saveError || null,
      },
    ];
  }, [accountFilterParams, accountsLoading, isSubmitting, saveError, usersLoading]);

  const validate = useCallback(() => {
    const next = {};
    if (!String(form.userId || '').trim()) next.userId = 'Select a user.';
    if (!String(form.paymentMode || '').trim()) next.paymentMode = 'Payment mode is required.';
    if (!String(form.paymentType || '').trim()) next.paymentType = 'Payment type is required.';
    const amountNum = parseAmountToNumber(form.amount);
    if (!amountNum || amountNum <= 0) next.amount = 'Enter a valid amount.';
    if (!String(form.paymentDate || '').trim()) next.paymentDate = 'Select a payment date.';
    if (isChequePaymentAccount(selectedPaymentAccount)) {
      if (!String(form.chequeNumber || '').trim()) next.chequeNumber = 'Cheque number is required.';
      if (!String(form.bankName || '').trim()) next.bankName = 'Bank name is required.';
      if (!String(form.chequeDate || '').trim()) next.chequeDate = 'Cheque date is required.';
    }
    return next;
  }, [form, selectedPaymentAccount]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onClose?.();
  }, [isSubmitting, onClose]);

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
      setSaveError('');
      try {
        const amountNum = parseAmountToNumber(form.amount);
        const payload = {
          user_id: String(form.userId),
          amount: amountNum,
          date: form.paymentDate || todayISO(),
          payment_type: form.paymentType,
          payment_mode: String(form.paymentMode),
          description: String(form.notes || '').trim(),
        };
        await savePaymentReceiptRequest(payload);
        toast.success('Payment saved successfully.', { delay: 2500 });
        onSaved?.();
        onClose?.();
      } catch (err) {
        const message = String(err?.message ?? 'Failed to save payment');
        setSaveError(message);
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [canSubmit, form, isSubmitting, onClose, onSaved, validate]
  );

  return (
    <AppModal
      open={open}
      onClose={handleClose}
      size="lg"
      disableBackdropClose={isSubmitting}
      title="Payment receipts"
      subtitle="Send or receive a payment. Required fields are marked with *."
      footer={
        <>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary mb-0 px-4"
            disabled={isSubmitting}
            onClick={handleClose}
          >
            <i className="fas fa-times me-2" />
            Cancel
          </button>
          <button
            type="submit"
            form="ledger-payment-receipt-form"
            className="btn btn-sm btn-primary mb-0 px-4"
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <i className="fas fa-check me-2" />
                Save Payment
              </>
            )}
          </button>
        </>
      }
    >
      <form id="ledger-payment-receipt-form" onSubmit={handleSubmit}>
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
                const nextAcc = assetAccounts.find((a) => String(a._id ?? a.id ?? '') === String(v));
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
              Payment Type <span className="text-danger">*</span>
            </label>
            <select
              className="form-select"
              disabled={isSubmitting}
              value={form.paymentType}
              onChange={(e) => setForm((p) => ({ ...p, paymentType: e.target.value }))}
            >
              <option value="Receive">Receive</option>
              <option value="Send">Send</option>
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

          {isChequePaymentAccount(selectedPaymentAccount) ? (
            <>
              <div className="col-lg-4 col-md-6 col-12">
                <label className="form-label text-sm font-weight-bold mb-1">Cheque Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter cheque number"
                  disabled={isSubmitting}
                  value={form.chequeNumber}
                  onChange={(e) => setForm((p) => ({ ...p, chequeNumber: e.target.value }))}
                />
                <FieldError error={errors.chequeNumber} />
              </div>
              <div className="col-lg-4 col-md-6 col-12">
                <label className="form-label text-sm font-weight-bold mb-1">Bank Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter bank name"
                  disabled={isSubmitting}
                  value={form.bankName}
                  onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
                />
                <FieldError error={errors.bankName} />
              </div>
              <div className="col-lg-4 col-md-6 col-12">
                <label className="form-label text-sm font-weight-bold mb-1">Cheque Date</label>
                <input
                  type="date"
                  className="form-control"
                  disabled={isSubmitting}
                  value={form.chequeDate}
                  onChange={(e) => setForm((p) => ({ ...p, chequeDate: e.target.value }))}
                />
                <FieldError error={errors.chequeDate} />
              </div>
            </>
          ) : null}
        </div>

        <DevApiSourcesFooter
          sources={apiSources}
          title="API request URLs"
          className="mt-3 mb-0"
        />
      </form>
    </AppModal>
  );
}
