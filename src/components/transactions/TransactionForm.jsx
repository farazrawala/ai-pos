import { useEffect, useMemo, useState } from 'react';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';

const accountOptionValue = (a) => a?._id ?? a?.id ?? '';
const accountOptionLabel = (a) => {
  const name = a?.name ?? a?.account_name ?? '';
  const code = a?.code ?? a?.account_code ?? '';
  if (code && name) return `${name} (${code})`;
  if (name) return name;
  return accountOptionValue(a) || 'Account';
};

const EMPTY_FORM = {
  transaction_number: '',
  account_id: '',
  type: 'debit',
  amount: '',
  description: '',
  status: 'active',
};

const pad = (n, len = 2) => String(n).padStart(len, '0');

/** Suggest a unique reference like TXN-DDMMYY-HHMMSS-<random>, matching existing entries. */
const generateTransactionNumber = () => {
  const d = new Date();
  const datePart = `${pad(d.getDate())}${pad(d.getMonth() + 1)}${pad(d.getFullYear() % 100)}`;
  const timePart = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.floor(1000000 + Math.random() * 9000000);
  return `TXN-${datePart}-${timePart}-${rand}`;
};

/**
 * Shared add/edit form for a single transaction (ledger line).
 * `initialValues` prefills for editing; `onSubmit(formValues)` is called with validated data.
 */
export default function TransactionForm({
  initialValues = null,
  onSubmit,
  submitting = false,
  submitLabel = 'Save transaction',
  onCancel,
}) {
  const [form, setForm] = useState(() =>
    initialValues
      ? EMPTY_FORM
      : { ...EMPTY_FORM, transaction_number: generateTransactionNumber() }
  );
  const [errors, setErrors] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('idle');

  useEffect(() => {
    if (initialValues) {
      setForm({
        transaction_number:
          initialValues.transaction_number ?? initialValues.transactionNumber ?? '',
        account_id: initialValues.account_id ?? '',
        type: (initialValues.type ?? 'debit').toLowerCase(),
        amount: initialValues.amount != null ? String(initialValues.amount) : '',
        description: initialValues.description ?? '',
        status: initialValues.status ?? 'active',
      });
    }
  }, [initialValues]);

  useEffect(() => {
    let cancelled = false;
    setAccountsStatus('loading');
    fetchAccountsRequest({ page: 1, limit: 500, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => {
        if (cancelled) return;
        setAccounts(Array.isArray(res.data) ? res.data : []);
        setAccountsStatus('succeeded');
      })
      .catch((err) => {
        console.error('[Transactions module] Failed to load accounts for form', err);
        if (!cancelled) {
          setAccounts([]);
          setAccountsStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accountOptions = useMemo(() => accounts, [accounts]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!String(form.transaction_number).trim())
      next.transaction_number = 'Transaction number is required';
    if (!String(form.account_id).trim()) next.account_id = 'Account is required';
    if (form.type !== 'debit' && form.type !== 'credit') next.type = 'Select debit or credit';
    const amt = Number(String(form.amount).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) next.amount = 'Enter a valid amount greater than zero';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      transaction_number: form.transaction_number.trim(),
      account_id: form.account_id.trim(),
      type: form.type,
      amount: Number(String(form.amount).replace(/,/g, '')),
      description: form.description.trim(),
      status: form.status,
    });
  };

  const handleRegenerateNumber = () => {
    setForm((prev) => ({ ...prev, transaction_number: generateTransactionNumber() }));
    if (errors.transaction_number)
      setErrors((prev) => ({ ...prev, transaction_number: '' }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label className="form-label" htmlFor="transaction_number">
          Transaction number <span className="text-danger">*</span>
        </label>
        <div className="input-group">
          <input
            id="transaction_number"
            name="transaction_number"
            type="text"
            className={`form-control ${errors.transaction_number ? 'is-invalid' : ''}`}
            value={form.transaction_number}
            onChange={handleChange}
            disabled={submitting}
            placeholder="e.g. TXN-030726-025334-3975229"
          />
          <button
            type="button"
            className="btn btn-outline-secondary mb-0"
            onClick={handleRegenerateNumber}
            disabled={submitting}
            title="Generate a new reference"
          >
            <i className="fas fa-sync-alt" aria-hidden="true" />
          </button>
          {errors.transaction_number && (
            <div className="invalid-feedback d-block">{errors.transaction_number}</div>
          )}
        </div>
        <div className="form-text">Must be unique. Auto-suggested — edit if needed.</div>
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="account_id">
          Account <span className="text-danger">*</span>
        </label>
        <select
          id="account_id"
          name="account_id"
          className={`form-select ${errors.account_id ? 'is-invalid' : ''}`}
          value={form.account_id}
          onChange={handleChange}
          disabled={submitting || accountsStatus === 'loading'}
        >
          <option value="">Select account…</option>
          {accountOptions.map((a) => (
            <option key={accountOptionValue(a)} value={accountOptionValue(a)}>
              {accountOptionLabel(a)}
            </option>
          ))}
        </select>
        {errors.account_id && <div className="invalid-feedback d-block">{errors.account_id}</div>}
        {accountsStatus === 'failed' && (
          <div className="small text-danger mt-1">Could not load accounts.</div>
        )}
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label className="form-label" htmlFor="type">
            Type <span className="text-danger">*</span>
          </label>
          <select
            id="type"
            name="type"
            className={`form-select ${errors.type ? 'is-invalid' : ''}`}
            value={form.type}
            onChange={handleChange}
            disabled={submitting}
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
          {errors.type && <div className="invalid-feedback d-block">{errors.type}</div>}
        </div>

        <div className="col-md-6 mb-3">
          <label className="form-label" htmlFor="amount">
            Amount <span className="text-danger">*</span>
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            className={`form-control ${errors.amount ? 'is-invalid' : ''}`}
            value={form.amount}
            onChange={handleChange}
            disabled={submitting}
            placeholder="e.g. 1500"
          />
          {errors.amount && <div className="invalid-feedback d-block">{errors.amount}</div>}
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          name="status"
          className="form-select"
          value={form.status}
          onChange={handleChange}
          disabled={submitting}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          className="form-control"
          rows={3}
          value={form.description}
          onChange={handleChange}
          disabled={submitting}
          placeholder="Optional note"
        />
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary mb-0" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            className="btn btn-outline-secondary mb-0"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
