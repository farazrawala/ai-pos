import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createAmountTransfer } from '../../features/amountTransfers/amountTransfersSlice.js';
import { buildAmountTransferAccountFilterParams, buildAmountTransferToAccountFilterParams } from '../../features/amountTransfers/amountTransfersAPI.js';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';
import { toast } from '../../utils/toast.js';
import { DEBUG } from '../../config/env.js';

const accountOptionValue = (a) => a?._id ?? a?.id ?? '';
const accountOptionLabel = (a) => {
  const name = a?.name ?? a?.account_name ?? '';
  const code = a?.code ?? a?.account_code ?? '';
  if (code && name) return `${name} (${code})`;
  if (name) return name;
  return accountOptionValue(a) || 'Account';
};

const AmountTransferAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.user.user);
  const authCompany = useSelector((state) => state.user.company);

  const [form, setForm] = useState({
    from_account_id: '',
    to_account_id: '',
    description: '',
    amount: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fromAccounts, setFromAccounts] = useState([]);
  const [toAccounts, setToAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('idle');

  useEffect(() => {
    let cancelled = false;
    const params = { page: 1, limit: 500, sortBy: 'name', sortOrder: 'asc' };

    setAccountsStatus('loading');
    Promise.all([
      buildAmountTransferAccountFilterParams(authUser, authCompany),
      buildAmountTransferToAccountFilterParams(authUser, authCompany),
    ])
      .then(([fromFilters, toFilters]) =>
        Promise.all([
          fetchAccountsRequest({
            ...params,
            account_type: fromFilters.account_type,
            exclude_id: fromFilters.exclude_id,
          }),
          fetchAccountsRequest({
            ...params,
            account_type: toFilters.account_type,
            exclude_id: toFilters.exclude_id,
            include_id: toFilters.include_id,
          }),
        ])
      )
      .then(([fromRes, toRes]) => {
        if (!cancelled) {
          setFromAccounts(Array.isArray(fromRes.data) ? fromRes.data : []);
          setToAccounts(Array.isArray(toRes.data) ? toRes.data : []);
          setAccountsStatus('succeeded');
        }
      })
      .catch((err) => {
        console.error('[Amount transfer module] Failed to load accounts for add form', err);
        if (!cancelled) {
          setFromAccounts([]);
          setToAccounts([]);
          setAccountsStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, authCompany]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (name === 'from_account_id' || name === 'to_account_id') {
      if (errors.to_account_id && errors.to_account_id.includes('different')) {
        setErrors((prev) => ({ ...prev, to_account_id: '' }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const fromId = String(form.from_account_id || '').trim();
    const toId = String(form.to_account_id || '').trim();
    if (!fromId) newErrors.from_account_id = 'From account is required';
    if (!toId) newErrors.to_account_id = 'To account is required';
    if (fromId && toId && fromId === toId) {
      newErrors.to_account_id = 'To account must be different from the from account';
    }
    const amt = Number(String(form.amount).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) {
      newErrors.amount = 'Enter a valid amount greater than zero';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const amount = Number(String(form.amount).replace(/,/g, ''));
      await dispatch(
        createAmountTransfer({
          transferFields: {
            from_account_id: form.from_account_id.trim(),
            to_account_id: form.to_account_id.trim(),
            description: form.description.trim(),
            amount,
          },
        })
      ).unwrap();
      toast.success('Amount transfer created successfully.');
      setTimeout(() => navigate('/amount-transfers'), 800);
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message || (error && String(error)) || 'Could not create amount transfer.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Add amount transfer</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      Saves via <code className="text-xs">POST /amount_transfer/save</code>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/amount-transfers')}
                >
                  Back to list
                </button>
              </div>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="from_account_id">
                    From account <span className="text-danger">*</span>
                  </label>
                  <select
                    id="from_account_id"
                    name="from_account_id"
                    className={`form-select ${errors.from_account_id ? 'is-invalid' : ''}`}
                    value={form.from_account_id}
                    onChange={handleChange}
                    disabled={isSubmitting || accountsStatus === 'loading'}
                  >
                    <option value="">Select account…</option>
                    {fromAccounts.map((a) => (
                      <option key={accountOptionValue(a)} value={accountOptionValue(a)}>
                        {accountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                  {errors.from_account_id && (
                    <div className="invalid-feedback d-block">{errors.from_account_id}</div>
                  )}
                  {accountsStatus === 'failed' && (
                    <div className="small text-danger mt-1">Could not load accounts.</div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="to_account_id">
                    To account <span className="text-danger">*</span>
                  </label>
                  <select
                    id="to_account_id"
                    name="to_account_id"
                    className={`form-select ${errors.to_account_id ? 'is-invalid' : ''}`}
                    value={form.to_account_id}
                    onChange={handleChange}
                    disabled={isSubmitting || accountsStatus === 'loading'}
                  >
                    <option value="">Select account…</option>
                    {toAccounts.map((a) => (
                      <option key={accountOptionValue(a)} value={accountOptionValue(a)}>
                        {accountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                  {errors.to_account_id && (
                    <div className="invalid-feedback d-block">{errors.to_account_id}</div>
                  )}
                </div>

                <div className="mb-3">
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
                    disabled={isSubmitting}
                    placeholder="e.g. 600"
                  />
                  {errors.amount && (
                    <div className="invalid-feedback d-block">{errors.amount}</div>
                  )}
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
                    disabled={isSubmitting}
                    placeholder="Optional note"
                  />
                </div>

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : 'Save transfer'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/amount-transfers')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmountTransferAdd;
