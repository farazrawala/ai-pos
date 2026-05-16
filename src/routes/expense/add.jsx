import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { saveExpense } from '../../features/expenses/expensesSlice.js';
import {
  buildExpenseDefaultAccountFilterParams,
  isExpenseUploadFilePart,
} from '../../features/expenses/expensesAPI.js';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';
import { fetchUsersRequest } from '../../features/users/usersAPI.js';
import { API_BASE_URL } from '../../config/apiConfig.js';

const EXPENSE_ACCOUNT_TYPE = 'operating_expense';
const PAYMENT_METHOD_ACCOUNT_TYPE = 'current_asset';

/** GET `account/get-all-active` URL for expense accounts (help text). */
const expenseAccountsListUrl = (accountType) => {
  const q = new URLSearchParams();
  q.set('skip', '0');
  q.set('limit', '500');
  q.set('sortBy', 'name');
  q.set('sortOrder', 'asc');
  q.set('account_type', accountType);
  const base = String(API_BASE_URL || '/api').replace(/\/+$/, '');
  return `${base}/account/get-all-active?${q.toString()}`;
};

/** Payment method accounts URL with company default include/exclude filters. */
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

/** Visible label only — never show raw ids in the UI. */
const userDisplayName = (u) => {
  const name = String(u?.name ?? '').trim();
  if (name) return name;
  const email = String(u?.email ?? '').trim();
  if (email) return email;
  return 'Unknown user';
};

const ExpenseAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.user.user);
  const authCompany = useSelector((state) => state.user.company);
  const defaultUserId = userOptionValue(authUser) || '';

  const [form, setForm] = useState({
    name: '',
    user_id: defaultUserId || '',
    account_id: '',
    amount: '0',
    payment_method_accounts_id: '',
    note: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [expenseAccountsStatus, setExpenseAccountsStatus] = useState('idle');
  const [paymentMethodAccounts, setPaymentMethodAccounts] = useState([]);
  const [paymentMethodAccountsStatus, setPaymentMethodAccountsStatus] = useState('idle');
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [paymentAccountFilterUrl, setPaymentAccountFilterUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const imageInputRef = useRef(null);

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
    const params = {
      page: 1,
      limit: 500,
      sortBy: 'name',
      sortOrder: 'asc',
    };

    setExpenseAccountsStatus('loading');
    fetchAccountsRequest({ ...params, account_type: EXPENSE_ACCOUNT_TYPE })
      .then((res) => {
        if (!cancelled) {
          setExpenseAccounts(Array.isArray(res.data) ? res.data : []);
          setExpenseAccountsStatus('succeeded');
        }
      })
      .catch((err) => {
        console.error('[Expense module] Failed to load expense (operating_expense) accounts', err);
        if (!cancelled) {
          setExpenseAccounts([]);
          setExpenseAccountsStatus('failed');
        }
      });

    setPaymentMethodAccountsStatus('loading');
    buildExpenseDefaultAccountFilterParams(authUser, authCompany)
      .then((accountFilters) => {
        if (!cancelled) setPaymentAccountFilterUrl(paymentAccountsListUrl(accountFilters));
        return fetchAccountsRequest({
          ...params,
          account_type: accountFilters.account_type ?? PAYMENT_METHOD_ACCOUNT_TYPE,
          include_id: accountFilters.include_id,
          exclude_id: accountFilters.exclude_id,
        });
      })
      .then((res) => {
        if (!cancelled) {
          setPaymentMethodAccounts(Array.isArray(res.data) ? res.data : []);
          setPaymentMethodAccountsStatus('succeeded');
        }
      })
      .catch((err) => {
        console.error('[Expense module] Failed to load payment (current_asset) accounts', err);
        if (!cancelled) {
          setPaymentMethodAccounts([]);
          setPaymentMethodAccountsStatus('failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, authCompany]);

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
        console.error('[Expense module] Failed to load users for expense form', err);
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
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    setErrors((prev) => ({ ...prev, image: '' }));
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setErrors((prev) => ({ ...prev, image: '' }));
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

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
    const amt = Number(form.amount);
    if (form.amount === '' || form.amount == null || Number.isNaN(amt)) {
      newErrors.amount = 'Enter a valid amount';
    } else if (amt < 0) {
      newErrors.amount = 'Amount cannot be negative';
    }
    if (!String(form.payment_method_accounts_id || '').trim()) {
      newErrors.payment_method_accounts_id = 'Please select a payment method account';
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
      const payload = {
        name: form.name.trim(),
        user_id: form.user_id.trim(),
        amount: form.amount,
        note: form.note,
        payment_method_accounts_id: form.payment_method_accounts_id.trim(),
      };
      if (form.account_id.trim()) payload.account_id = form.account_id.trim();

      const hadImage = isExpenseUploadFilePart(imageFile);
      await dispatch(
        saveExpense({
          expenseFields: payload,
          image: hadImage ? imageFile : undefined,
        })
      ).unwrap();
      showToast('successToast', 'Expense saved successfully.');
      setTimeout(() => navigate('/expenses'), 1000);
    } catch (error) {
      const normalizedMessage =
        typeof error === 'string'
          ? error
          : error?.message || (error && String(error)) || 'Could not create expense.';
      console.error('[Expense module] Add expense form submit failed', {
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
                  <h5 className="mb-0">Add expense</h5>
                  <p className="text-sm mb-0 text-muted">
                    Saves via <code className="text-xs">POST /expense/save</code> (multipart when
                    attachment is added)
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/expenses')}
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
                    placeholder="e.g. salary"
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>

                <div className="mb-3">
                  <label htmlFor="user_id" className="form-label">
                    User name <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.user_id ? 'is-invalid' : ''}`}
                    id="user_id"
                    name="user_id"
                    value={form.user_id}
                    onChange={handleChange}
                    disabled={usersStatus === 'loading'}
                  >
                    <option value="">Select user…</option>
                    {(() => {
                      const authId = userOptionValue(authUser);
                      const authInList = authId && users.some((u) => userOptionValue(u) === authId);
                      const extra =
                        authId && !authInList ? (
                          <option key={`auth-${authId}`} value={authId}>
                            {userDisplayName(authUser)}
                          </option>
                        ) : null;
                      const sorted = [...users].sort((a, b) =>
                        userDisplayName(a).localeCompare(userDisplayName(b), undefined, {
                          sensitivity: 'base',
                        })
                      );
                      return (
                        <>
                          {extra}
                          {sorted.map((u, idx) => (
                            <option
                              key={userOptionValue(u) ? `u-${userOptionValue(u)}` : `u-idx-${idx}`}
                              value={userOptionValue(u)}
                            >
                              {userDisplayName(u)}
                            </option>
                          ))}
                        </>
                      );
                    })()}
                  </select>
                  {errors.user_id && (
                    <div className="invalid-feedback d-block">{errors.user_id}</div>
                  )}
                  <small className="text-muted d-block mt-1">
                    Choose the person this expense belongs to. The signed-in user is selected when
                    the list loads, if available.
                  </small>
                </div>

                <div className="mb-3">
                  <label htmlFor="account_id" className="form-label">
                    Expense account
                  </label>
                  <select
                    className="form-select"
                    id="account_id"
                    name="account_id"
                    value={form.account_id}
                    onChange={handleChange}
                    disabled={expenseAccountsStatus === 'loading'}
                  >
                    <option value="">None</option>
                    {expenseAccounts.map((a, idx) => (
                      <option
                        key={accountOptionValue(a) ? `a-${accountOptionValue(a)}` : `a-idx-${idx}`}
                        value={accountOptionValue(a)}
                      >
                        {accountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted d-block mt-1">
                    Source:{' '}
                    <code className="text-xs user-select-all" style={{ wordBreak: 'break-all' }}>
                      {expenseAccountsListUrl(EXPENSE_ACCOUNT_TYPE)}
                    </code>
                  </small>
                  {expenseAccountsStatus === 'failed' && (
                    <small className="text-danger d-block mt-1">Could not load expense accounts.</small>
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
                  />
                  {errors.amount && <div className="invalid-feedback">{errors.amount}</div>}
                </div>

                <div className="mb-3">
                  <label htmlFor="payment_method_accounts_id" className="form-label">
                    Payment method account <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.payment_method_accounts_id ? 'is-invalid' : ''}`}
                    id="payment_method_accounts_id"
                    name="payment_method_accounts_id"
                    value={form.payment_method_accounts_id}
                    onChange={handleChange}
                    disabled={paymentMethodAccountsStatus === 'loading'}
                    required
                  >
                    <option value="">Select payment method…</option>
                    {paymentMethodAccounts.map((a, idx) => (
                      <option
                        key={
                          accountOptionValue(a) ? `pm-${accountOptionValue(a)}` : `pm-idx-${idx}`
                        }
                        value={accountOptionValue(a)}
                      >
                        {accountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                  {errors.payment_method_accounts_id && (
                    <div className="invalid-feedback d-block">
                      {errors.payment_method_accounts_id}
                    </div>
                  )}
                  {paymentAccountFilterUrl && (
                    <small className="text-muted d-block mt-1">
                      Accounts:{' '}
                      <code className="text-xs user-select-all" style={{ wordBreak: 'break-all' }}>
                        {paymentAccountFilterUrl}
                      </code>
                      <span className="d-block">
                        Uses <code className="text-xs">default_account_payable_account</code> (include)
                        and <code className="text-xs">default_account_receivable_account</code> (exclude)
                        from company settings.
                      </span>
                    </small>
                  )}
                  {paymentMethodAccountsStatus === 'failed' && (
                    <small className="text-danger d-block mt-1">
                      Could not load payment method accounts.
                    </small>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="expense_attachment" className="form-label">
                    Attachments
                  </label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    className={`form-control ${errors.image ? 'is-invalid' : ''}`}
                    id="expense_attachment"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleImageChange}
                    disabled={isSubmitting}
                  />
                  {errors.image && (
                    <div className="invalid-feedback d-block">{errors.image}</div>
                  )}
                  <small className="text-muted d-block">
                    Optional. Uploaded as field <code className="text-xs">image</code> on{' '}
                    <code className="text-xs">POST /expense/save</code>.
                  </small>
                  {imagePreview && imageFile?.type?.startsWith('image/') && (
                    <div className="mt-3 d-flex align-items-start gap-2">
                      <img
                        src={imagePreview}
                        alt="Attachment preview"
                        className="rounded border"
                        style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={clearImage}
                        disabled={isSubmitting}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {imageFile && !imageFile.type?.startsWith('image/') && (
                    <div className="mt-2 d-flex align-items-center gap-2">
                      <span className="text-sm">
                        <i className="fas fa-paperclip me-1"></i>
                        {imageFile.name}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={clearImage}
                        disabled={isSubmitting}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label htmlFor="note" className="form-label">
                    Note
                  </label>
                  <textarea
                    className="form-control"
                    id="note"
                    name="note"
                    rows={3}
                    value={form.note}
                    onChange={handleChange}
                    placeholder="Optional note"
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/expenses')}
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
                        Create expense
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
          <div className="toast-body">Expense saved successfully.</div>
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
          <div className="toast-body">An error occurred.</div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseAdd;
