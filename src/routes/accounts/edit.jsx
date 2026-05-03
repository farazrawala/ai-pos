import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchAccountById,
  updateAccount,
  clearCurrentAccount,
  clearUpdateStatus,
} from '../../features/accounts/accountsSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { ACCOUNT_TYPE_OPTIONS } from '../../constants/accountTypes.js';

const EditAccount = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = usePermissions('accounts');
  const { currentAccount, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.accounts
  );

  const [form, setForm] = useState({
    name: '',
    account_type: '',
    status: 'active',
    initial_balance: '',
  });
  const [errors, setErrors] = useState({});
  const isSubmitting = updateStatus === 'loading';

  useEffect(() => {
    if (canEdit === false) navigate('/accounts');
  }, [canEdit, navigate]);

  useEffect(() => {
    if (id) dispatch(fetchAccountById(id));
    return () => {
      dispatch(clearCurrentAccount());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!currentAccount) return;
    const ibRaw =
      currentAccount.initial_balance ??
      currentAccount.initialBalance ??
      currentAccount.opening_balance ??
      '';
    setForm({
      name: currentAccount.name || '',
      account_type: currentAccount.account_type || '',
      status: currentAccount.status || 'active',
      initial_balance:
        ibRaw === '' || ibRaw == null ? '' : String(ibRaw).replace(/,/g, ''),
    });
  }, [currentAccount]);

  const validateForm = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (!form.account_type.trim()) nextErrors.account_type = 'Account type is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const balanceParsed = parseFloat(String(form.initial_balance).replace(/,/g, ''));
    const initial_balance = Number.isFinite(balanceParsed) ? balanceParsed : 0;
    try {
      await dispatch(
        updateAccount({
          accountId: id,
          accountData: {
            name: form.name.trim(),
            account_type: form.account_type.trim(),
            status: form.status,
            initial_balance,
          },
        })
      ).unwrap();
      navigate('/accounts');
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        submit: error?.message || error || 'Failed to update account',
      }));
    }
  };

  if (fetchStatus === 'loading') {
    return <div className="container-fluid py-4">Loading account...</div>;
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger">{fetchError || 'Failed to load account.'}</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Edit Account</h5>
                  <p className="text-sm mb-0">Update account details.</p>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/accounts')}
                >
                  Back to List
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={isSubmitting}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Account Type <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.account_type ? 'is-invalid' : ''}`}
                    value={form.account_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, account_type: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    <option value="">Select account type</option>
                    {ACCOUNT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.account_type && (
                    <div className="invalid-feedback">{errors.account_type}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label">Initial balance</label>
                  <input
                    type="number"
                    className="form-control"
                    step="0.01"
                    placeholder="0.00"
                    value={form.initial_balance}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, initial_balance: e.target.value }))
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>

                {(errors.submit || updateError) && (
                  <div className="alert alert-danger py-2">{errors.submit || updateError}</div>
                )}

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/accounts')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating...' : 'Update Account'}
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

export default EditAccount;
