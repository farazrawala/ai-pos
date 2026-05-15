import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { createExpense } from '../../features/expenses/expensesSlice.js';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';
import { fetchUsersRequest } from '../../features/users/usersAPI.js';

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
const userOptionLabel = (u) => {
  const name = u?.name ?? u?.email ?? '';
  const id = userOptionValue(u);
  if (name) return `${name} (${id})`;
  return id || 'User';
};

const ExpenseAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user: authUser } = useSelector((state) => state.user);
  const defaultUserId = userOptionValue(authUser) || '';

  const [form, setForm] = useState({
    name: 'salary',
    user_id: defaultUserId || '68def99e48aeb332dabf1351',
    account_id: '',
    amount: '300',
    payment_method_accounts_id: '',
    note: 'Lorem ispum',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('idle');
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [userPickerKey, setUserPickerKey] = useState(0);

  useEffect(() => {
    const uid = userOptionValue(authUser);
    if (uid) {
      setForm((prev) => (prev.user_id === '68def99e48aeb332dabf1351' ? { ...prev, user_id: uid } : prev));
    }
  }, [authUser]);

  useEffect(() => {
    let cancelled = false;
    setAccountsStatus('loading');
    fetchAccountsRequest({ page: 1, limit: 500, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => {
        if (!cancelled) {
          setAccounts(Array.isArray(res.data) ? res.data : []);
          setAccountsStatus('succeeded');
        }
      })
      .catch((err) => {
        console.error('[Expense module] Failed to load accounts for expense form', err);
        if (!cancelled) {
          setAccounts([]);
          setAccountsStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      newErrors.user_id = 'User is required';
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
      };
      if (form.account_id.trim()) payload.account_id = form.account_id.trim();
      if (form.payment_method_accounts_id.trim()) {
        payload.payment_method_accounts_id = form.payment_method_accounts_id.trim();
      }

      await dispatch(createExpense(payload)).unwrap();
      showToast('successToast', 'Expense created successfully.');
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
                  <p className="text-sm mb-0 text-muted">Creates a record via expense/create</p>
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
                    User id <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.user_id ? 'is-invalid' : ''}`}
                    id="user_id"
                    name="user_id"
                    placeholder="MongoDB user id"
                    value={form.user_id}
                    onChange={handleChange}
                    list="expense-user-datalist"
                    autoComplete="off"
                  />
                  <datalist id="expense-user-datalist">
                    {users.map((u, idx) => (
                      <option
                        key={userOptionValue(u) ? `dl-${userOptionValue(u)}` : `dl-${idx}`}
                        value={userOptionValue(u)}
                      >
                        {userOptionLabel(u)}
                      </option>
                    ))}
                  </datalist>
                  {errors.user_id && <div className="invalid-feedback d-block">{errors.user_id}</div>}
                  <select
                    key={userPickerKey}
                    className="form-select mt-2"
                    aria-label="Pick user from list"
                    defaultValue=""
                    disabled={usersStatus === 'loading'}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        setForm((prev) => ({ ...prev, user_id: v }));
                        setErrors((prev) => ({ ...prev, user_id: '' }));
                        setUserPickerKey((k) => k + 1);
                      }
                    }}
                  >
                    <option value="">Quick pick from directory…</option>
                    {users.map((u, idx) => (
                      <option
                        key={userOptionValue(u) ? `u-${userOptionValue(u)}` : `u-idx-${idx}`}
                        value={userOptionValue(u)}
                      >
                        {userOptionLabel(u)}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted d-block mt-1">
                    Prefills from the signed-in user when available; example id{' '}
                    <code>68def99e48aeb332dabf1351</code>.
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
                    disabled={accountsStatus === 'loading'}
                  >
                    <option value="">None</option>
                    {accounts.map((a, idx) => (
                      <option
                        key={accountOptionValue(a) ? `a-${accountOptionValue(a)}` : `a-idx-${idx}`}
                        value={accountOptionValue(a)}
                      >
                        {accountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                  {accountsStatus === 'failed' && (
                    <small className="text-danger d-block mt-1">Could not load accounts.</small>
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
                    Payment method account
                  </label>
                  <select
                    className="form-select"
                    id="payment_method_accounts_id"
                    name="payment_method_accounts_id"
                    value={form.payment_method_accounts_id}
                    onChange={handleChange}
                    disabled={accountsStatus === 'loading'}
                  >
                    <option value="">None</option>
                    {accounts.map((a, idx) => (
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
          <div className="toast-body">Expense created successfully.</div>
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
