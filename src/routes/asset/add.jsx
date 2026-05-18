import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { createAsset } from '../../features/assets/assetsSlice.js';
import { ASSET_TYPE_OPTIONS } from '../../features/assets/assetsAPI.js';
import { buildExpenseDefaultAccountFilterParams } from '../../features/expenses/expensesAPI.js';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';
import { fetchUsersRequest } from '../../features/users/usersAPI.js';
import { API_BASE_URL } from '../../config/apiConfig.js';

const PAYMENT_TYPE_ACCOUNT_TYPE = 'current_asset';

const paymentAccountsListUrl = (filters) => {
  const q = new URLSearchParams();
  q.set('skip', '0');
  q.set('limit', '500');
  q.set('sortBy', 'name');
  q.set('sortOrder', 'asc');
  if (filters?.account_type) q.set('account_type', filters.account_type);
  if (filters?.include_id) q.set('include_id', filters.include_id);
  if (filters?.exclude_id) q.set('exclude_id', filters.exclude_id);
  const base = String(API_BASE_URL || '/api').replace(/\/+$/, '');
  return `${base}/account/get-all-active?${q.toString()}`;
};

const accountOptionValue = (a) => a?._id ?? a?.id ?? '';
const accountOptionLabel = (a) => {
  const name = a?.name ?? a?.account_name ?? '';
  const code = a?.code ?? a?.account_code ?? '';
  const id = accountOptionValue(a);
  if (code && name) return `${name} (${code})`;
  if (name) return name;
  return id || 'Account';
};

const userOptionValue = (u) => u?._id ?? u?.id ?? '';

const userDisplayName = (u) => {
  const name = String(u?.name ?? '').trim();
  if (name) return name;
  const email = String(u?.email ?? '').trim();
  if (email) return email;
  return 'Unknown user';
};

const AssetAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.user.user);
  const authCompany = useSelector((state) => state.user.company);
  const defaultUserId = userOptionValue(authUser) || '';

  const [form, setForm] = useState({
    name: '',
    user_id: defaultUserId,
    description: '',
    asset_type: 'buy',
    payment_type: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [paymentTypeAccounts, setPaymentTypeAccounts] = useState([]);
  const [paymentTypeAccountsStatus, setPaymentTypeAccountsStatus] = useState('idle');
  const [paymentAccountFilterUrl, setPaymentAccountFilterUrl] = useState('');

  useEffect(() => {
    const uid = userOptionValue(authUser);
    if (!uid) return;
    setForm((prev) => {
      if (prev.user_id) return prev;
      return { ...prev, user_id: uid };
    });
  }, [authUser]);

  useEffect(() => {
    let cancelled = false;
    setUsersStatus('loading');
    fetchUsersRequest({ page: 1, limit: 500 })
      .then((res) => {
        if (!cancelled) {
          setUsers(Array.isArray(res.data) ? res.data : []);
          setUsersStatus('succeeded');
        }
      })
      .catch((err) => {
        console.error('[Asset module] Failed to load users for asset form', err);
        if (!cancelled) {
          setUsers([]);
          setUsersStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = {
      page: 1,
      limit: 500,
      sortBy: 'name',
      sortOrder: 'asc',
    };

    setPaymentTypeAccountsStatus('loading');
    buildExpenseDefaultAccountFilterParams(authUser, authCompany)
      .then((accountFilters) => {
        if (!cancelled) setPaymentAccountFilterUrl(paymentAccountsListUrl(accountFilters));
        return fetchAccountsRequest({
          ...params,
          account_type: accountFilters.account_type ?? PAYMENT_TYPE_ACCOUNT_TYPE,
          include_id: accountFilters.include_id,
          exclude_id: accountFilters.exclude_id,
        });
      })
      .then((res) => {
        if (!cancelled) {
          setPaymentTypeAccounts(Array.isArray(res.data) ? res.data : []);
          setPaymentTypeAccountsStatus('succeeded');
        }
      })
      .catch((err) => {
        console.error('[Asset module] Failed to load payment type (current_asset) accounts', err);
        if (!cancelled) {
          setPaymentTypeAccounts([]);
          setPaymentTypeAccountsStatus('failed');
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
  };

  const validateForm = () => {
    const newErrors = {};
    if (!String(form.name || '').trim()) {
      newErrors.name = 'Name is required';
    }
    if (!String(form.user_id || '').trim()) {
      newErrors.user_id = 'Please select a user';
    }
    if (!String(form.asset_type || '').trim()) {
      newErrors.asset_type = 'Asset type is required';
    }
    if (!String(form.payment_type || '').trim()) {
      newErrors.payment_type = 'Please select a payment type';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const showToast = (id, bodyText) => {
    const toastElement = document.getElementById(id);
    if (!toastElement) return;
    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) {
      timeElement.textContent = moment().format('h:mm A');
    }
    if (bodyText) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = bodyText;
    }
    if (window.bootstrap && window.bootstrap.Toast) {
      const toast = new window.bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 5000,
      });
      toast.show();
    } else {
      toastElement.classList.remove('hide');
      toastElement.classList.add('show');
      setTimeout(() => {
        toastElement.classList.remove('show');
        toastElement.classList.add('hide');
      }, 5000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const assetFields = {
        name: form.name.trim(),
        user_id: form.user_id.trim(),
        description: form.description.trim(),
        asset_type: form.asset_type.trim(),
        payment_type: form.payment_type.trim(),
      };

      await dispatch(createAsset({ assetFields })).unwrap();
      showToast('successToast', 'Asset created successfully.');
      setTimeout(() => navigate('/assets'), 1000);
    } catch (error) {
      const normalizedMessage =
        typeof error === 'string'
          ? error
          : error?.message || (error && String(error)) || 'Could not create asset.';
      console.error('[Asset module] Add asset form submit failed', {
        message: normalizedMessage,
        raw: error,
      });
      showToast('dangerToast', normalizedMessage);
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
                  <h5 className="mb-0">Add asset</h5>
                  <p className="text-sm mb-0 text-muted">
                    Creates via <code className="text-xs">POST /assets/create</code>
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/assets')}
                >
                  <i className="fas fa-arrow-left me-1"></i>
                  Back
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Office equipment"
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>

                <div className="mb-3">
                  <label htmlFor="user_id" className="form-label">
                    User <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.user_id ? 'is-invalid' : ''}`}
                    id="user_id"
                    name="user_id"
                    value={form.user_id}
                    onChange={handleChange}
                    disabled={usersStatus === 'loading'}
                  >
                    <option value="">Select user</option>
                    {users.map((u) => (
                      <option key={userOptionValue(u)} value={userOptionValue(u)}>
                        {userDisplayName(u)}
                      </option>
                    ))}
                  </select>
                  {errors.user_id && (
                    <div className="invalid-feedback d-block">{errors.user_id}</div>
                  )}
                  {usersStatus === 'failed' && (
                    <small className="text-danger d-block mt-1">Could not load users.</small>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="asset_type" className="form-label">
                    Asset type <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.asset_type ? 'is-invalid' : ''}`}
                    id="asset_type"
                    name="asset_type"
                    value={form.asset_type}
                    onChange={handleChange}
                  >
                    {ASSET_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors.asset_type && (
                    <div className="invalid-feedback d-block">{errors.asset_type}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="payment_type" className="form-label">
                    Payment type <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.payment_type ? 'is-invalid' : ''}`}
                    id="payment_type"
                    name="payment_type"
                    value={form.payment_type}
                    onChange={handleChange}
                    disabled={paymentTypeAccountsStatus === 'loading'}
                  >
                    <option value="">Select payment type</option>
                    {paymentTypeAccounts.map((a, idx) => (
                      <option
                        key={
                          accountOptionValue(a) ? `pt-${accountOptionValue(a)}` : `pt-idx-${idx}`
                        }
                        value={accountOptionValue(a)}
                      >
                        {accountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                  {errors.payment_type && (
                    <div className="invalid-feedback d-block">{errors.payment_type}</div>
                  )}
                  {paymentTypeAccountsStatus === 'failed' && (
                    <small className="text-danger d-block mt-1">Could not load payment accounts.</small>
                  )}
                  {paymentAccountFilterUrl && (
                    <small className="text-muted d-block mt-1">
                      Accounts:{' '}
                      <code className="text-xs user-select-all" style={{ wordBreak: 'break-all' }}>
                        {paymentAccountFilterUrl}
                      </code>
                      <span className="d-block">
                        Uses <code className="text-xs">default_account_payable_account</code> (include)
                        and <code className="text-xs">default_account_receivable_account</code>{' '}
                        (exclude) from company settings.
                      </span>
                    </small>
                  )}
                </div>

                <div className="mb-4">
                  <label htmlFor="description" className="form-label">
                    Description
                  </label>
                  <textarea
                    className="form-control"
                    id="description"
                    name="description"
                    rows="4"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Optional description"
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/assets')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-2"></i>
                        Create asset
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="position-fixed bottom-1 end-1 z-index-2">
        <div
          className="toast fade hide p-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="successToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Asset created successfully!</div>
        </div>

        <div
          className="toast fade hide p-2 mt-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="dangerToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-notification-70 text-danger me-2"></i>
            <span className="me-auto text-gradient text-danger font-weight-bold">Error</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Could not create asset.</div>
        </div>
      </div>
    </div>
  );
};

export default AssetAdd;
