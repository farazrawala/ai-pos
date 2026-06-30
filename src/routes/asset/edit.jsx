import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import {
  fetchAssetById,
  updateAsset,
  clearCurrentAsset,
  clearUpdateStatus,
} from '../../features/assets/assetsSlice.js';
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

const refId = (ref) => {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'object') return String(ref._id ?? ref.id ?? '');
  return String(ref);
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
  if (typeof u === 'object' && u != null) {
    const name = String(u.name ?? '').trim();
    if (name) return name;
    const email = String(u.email ?? '').trim();
    if (email) return email;
  }
  return 'Unknown user';
};

const AssetEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentAsset, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.assets
  );
  const authUser = useSelector((state) => state.user.user);
  const authCompany = useSelector((state) => state.user.company);

  const [form, setForm] = useState({
    name: '',
    user_id: '',
    description: '',
    asset_type: 'buy',
    amount: '',
    account_id: '',
  });
  const [errors, setErrors] = useState({});
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [paymentTypeAccounts, setPaymentTypeAccounts] = useState([]);
  const [paymentTypeAccountsStatus, setPaymentTypeAccountsStatus] = useState('idle');
  const [paymentAccountFilterUrl, setPaymentAccountFilterUrl] = useState('');

  const isLoading = fetchStatus === 'loading';
  const isSubmitting = updateStatus === 'loading';

  useEffect(() => {
    if (id) dispatch(fetchAssetById(id));
    return () => {
      dispatch(clearCurrentAsset());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

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
        console.error('[Asset module] Failed to load users for edit form', err);
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
    const params = { page: 1, limit: 500, sortBy: 'name', sortOrder: 'asc' };

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
        console.error('[Asset module] Failed to load payment accounts for edit form', err);
        if (!cancelled) {
          setPaymentTypeAccounts([]);
          setPaymentTypeAccountsStatus('failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, authCompany]);

  useEffect(() => {
    if (!currentAsset) return;
    setForm({
      name: currentAsset.name || '',
      user_id: refId(currentAsset.user_id),
      description: currentAsset.description != null ? String(currentAsset.description) : '',
      asset_type: currentAsset.asset_type || 'buy',
      amount: currentAsset.amount != null ? String(currentAsset.amount) : '',
      account_id: refId(currentAsset.account_id),
    });
  }, [currentAsset]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!String(form.name || '').trim()) newErrors.name = 'Name is required';
    if (!String(form.user_id || '').trim()) newErrors.user_id = 'Please select a user';
    if (!String(form.asset_type || '').trim()) newErrors.asset_type = 'Asset type is required';
    if (!String(form.account_id || '').trim()) {
      newErrors.account_id = 'Please select a payment type';
    }
    const amt = Number(form.amount);
    if (form.amount === '' || form.amount == null || Number.isNaN(amt)) {
      newErrors.amount = 'Enter a valid amount';
    } else if (amt < 0) {
      newErrors.amount = 'Amount cannot be negative';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const showToast = (toastId, bodyText) => {
    const toastElement = document.getElementById(toastId);
    if (!toastElement) return;
    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) timeElement.textContent = moment().format('h:mm A');
    if (bodyText) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = bodyText;
    }
    if (window.bootstrap?.Toast) {
      new window.bootstrap.Toast(toastElement, { autohide: true, delay: 5000 }).show();
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

    try {
      await dispatch(
        updateAsset({
          assetId: id,
          assetFields: {
            name: form.name.trim(),
            user_id: form.user_id.trim(),
            description: form.description.trim(),
            asset_type: form.asset_type.trim(),
            amount: form.amount,
            account_id: form.account_id.trim(),
          },
        })
      ).unwrap();
      showToast('successToast', 'Asset updated successfully.');
      setTimeout(() => navigate('/assets'), 1000);
    } catch (error) {
      const msg =
        typeof error === 'string'
          ? error
          : error?.message || updateError || 'Could not update asset.';
      console.error('[Asset module] Edit asset form submit failed', { message: msg, raw: error });
      showToast('dangerToast', msg);
    }
  };

  const userOptions = () => {
    const list = [...users];
    const selectedId = form.user_id;
    const populated =
      currentAsset?.user_id && typeof currentAsset.user_id === 'object'
        ? currentAsset.user_id
        : null;
    if (populated && selectedId && !list.some((u) => userOptionValue(u) === selectedId)) {
      list.unshift(populated);
    }
    return list;
  };

  const accountOptions = () => {
    const list = [...paymentTypeAccounts];
    const selectedId = form.account_id;
    const populated =
      currentAsset?.account_id && typeof currentAsset.account_id === 'object'
        ? currentAsset.account_id
        : null;
    if (
      populated &&
      selectedId &&
      !list.some((a) => accountOptionValue(a) === selectedId)
    ) {
      list.unshift(populated);
    }
    return list;
  };

  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger m-3" role="alert">
          {fetchError || 'Failed to load asset.'}
        </div>
        <button type="button" className="btn btn-outline-secondary ms-3" onClick={() => navigate('/assets')}>
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Edit asset</h5>
                  <p className="text-sm mb-0 text-muted">
                    Updates via <code className="text-xs">PATCH /assets/update/:id</code>
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
              {isLoading ? (
                <p className="text-sm text-muted py-4 mb-0">Loading asset…</p>
              ) : (
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
                      disabled={isSubmitting}
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
                      disabled={usersStatus === 'loading' || isSubmitting}
                    >
                      <option value="">Select user</option>
                      {userOptions().map((u) => (
                        <option key={userOptionValue(u)} value={userOptionValue(u)}>
                          {userDisplayName(u)}
                        </option>
                      ))}
                    </select>
                    {errors.user_id && (
                      <div className="invalid-feedback d-block">{errors.user_id}</div>
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
                      disabled={isSubmitting}
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
                    <label htmlFor="amount" className="form-label">
                      Amount <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`form-control ${errors.amount ? 'is-invalid' : ''}`}
                      id="amount"
                      name="amount"
                      value={form.amount}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                    {errors.amount && <div className="invalid-feedback">{errors.amount}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="account_id" className="form-label">
                      Payment type <span className="text-danger">*</span>
                    </label>
                    <select
                      className={`form-select ${errors.account_id ? 'is-invalid' : ''}`}
                      id="account_id"
                      name="account_id"
                      value={form.account_id}
                      onChange={handleChange}
                      disabled={paymentTypeAccountsStatus === 'loading' || isSubmitting}
                    >
                      <option value="">Select payment type</option>
                      {accountOptions().map((a, idx) => (
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
                    {errors.account_id && (
                      <div className="invalid-feedback d-block">{errors.account_id}</div>
                    )}
                    {paymentAccountFilterUrl && (
                      <small className="text-muted d-block mt-1">
                        Accounts:{' '}
                        <code className="text-xs user-select-all" style={{ wordBreak: 'break-all' }}>
                          {paymentAccountFilterUrl}
                        </code>
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
                      disabled={isSubmitting}
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
                          Saving…
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save me-2"></i>
                          Save changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
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
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Asset updated successfully!</div>
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
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Could not update asset.</div>
        </div>
      </div>
    </div>
  );
};

export default AssetEdit;
