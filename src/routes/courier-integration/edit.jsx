import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchCourierById,
  updateCourier,
  clearCurrentCourier,
  clearUpdateStatus,
} from '../../features/courier/courierSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';
import {
  COURIER_TYPES,
  courierApiUrlPlaceholder,
  isPostexMerchantPortalUrl,
  validateCourierApiUrl,
  COURIER_DEFAULT_API_URLS,
  testCourierCredentialsRequest,
} from '../../features/courier/courierAPI.js';

const CourierIntegrationEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCourier, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.courier
  );
  const { canEdit } = usePermissions('courier-integration');
  const [form, setForm] = useState({
    name: '',
    type: 'tcs',
    url: '',
    login: '',
    password: '',
    token: '',
    account_no: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const isSubmitting = updateStatus === 'loading';
  const formBusy = isSubmitting || isTesting;

  useEffect(() => {
    if (canEdit === false) navigate('/courier-integration');
  }, [canEdit, navigate]);

  useEffect(() => {
    if (id) dispatch(fetchCourierById(id));
    return () => {
      dispatch(clearCurrentCourier());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!currentCourier) return;
    setForm({
      name: currentCourier.name || '',
      type: currentCourier.type || 'tcs',
      url: currentCourier.url || '',
      login: currentCourier.login || '',
      password: '',
      token: '',
      account_no: currentCourier.account_no || '',
      status: currentCourier.status || 'active',
    });
  }, [currentCourier]);

  const applySuggestedApiUrl = () => {
    const suggested = courierApiUrlPlaceholder(form.type);
    if (!suggested || suggested === 'https://…') return;
    setForm((prev) => ({ ...prev, url: suggested }));
    if (errors.url) setErrors((prev) => ({ ...prev, url: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (!form.type) nextErrors.type = 'Courier type is required';
    const urlError = validateCourierApiUrl(form.type, form.url);
    if (urlError) nextErrors.url = urlError;
    if (!form.login.trim()) nextErrors.login = 'Login is required';
    if (form.type === 'postex' && !form.account_no.trim()) {
      nextErrors.account_no =
        'PostEx pickup address code is required (e.g. 001). Both pickup and store codes cannot be empty.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleTestCredentials = async () => {
    const nextErrors = {};
    const urlError = validateCourierApiUrl(form.type, form.url);
    if (urlError) nextErrors.url = urlError;
    if (!form.login.trim()) nextErrors.login = 'Login is required';
    setErrors((prev) => ({ ...prev, ...nextErrors, submit: '' }));
    if (Object.keys(nextErrors).length) {
      setTestResult(null);
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testCourierCredentialsRequest(id, {
        type: form.type,
        url: form.url.trim(),
        login: form.login.trim(),
        password: form.password,
        token: form.token,
        account_no: form.account_no.trim(),
      });
      setTestResult({ ok: true, message: result.message || 'Credentials OK' });
      toast.success(result.message || 'Credentials OK');
    } catch (error) {
      const message = error?.message || 'Credential check failed';
      setTestResult({ ok: false, message });
      toast.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const payload = {
      name: form.name.trim(),
      type: form.type,
      url: form.url.trim(),
      login: form.login.trim(),
      account_no: form.account_no.trim(),
      status: form.status,
    };
    if (form.password.trim()) {
      payload.password = form.password;
    }
    if (form.token.trim()) {
      payload.token = form.token.trim();
    }
    try {
      await dispatch(updateCourier({ courierId: id, courierData: payload })).unwrap();
      toast.success('Courier integration updated.');
      navigate('/courier-integration');
    } catch (error) {
      const message = error?.message || error || 'Failed to update courier integration';
      setErrors((prev) => ({ ...prev, submit: message }));
      toast.error(message);
    }
  };

  if (fetchStatus === 'loading') {
    return <div className="container-fluid py-4">Loading courier integration…</div>;
  }
  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger">
          {fetchError || 'Failed to load courier integration.'}
        </div>
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
                  <h5 className="mb-0">Edit Courier Integration</h5>
                  <p className="text-sm mb-0">Update courier API credentials.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/courier-integration')}
                >
                  Back to List
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-name">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="courier-edit-name"
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    placeholder="e.g. TCS Main Account"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={formBusy}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-type">
                    Type <span className="text-danger">*</span>
                  </label>
                  <select
                    id="courier-edit-type"
                    className={`form-select ${errors.type ? 'is-invalid' : ''}`}
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                    disabled={formBusy}
                  >
                    {COURIER_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors.type && <div className="invalid-feedback">{errors.type}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-url">
                    API URL <span className="text-danger">*</span>
                  </label>
                  <input
                    id="courier-edit-url"
                    type="url"
                    className={`form-control ${errors.url ? 'is-invalid' : ''}`}
                    placeholder={courierApiUrlPlaceholder(form.type)}
                    value={form.url}
                    onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                    disabled={formBusy}
                  />
                  {form.type === 'postex' && isPostexMerchantPortalUrl(form.url) ? (
                    <div className="alert alert-warning py-2 mt-2 mb-0">
                      <div className="mb-2">
                        <strong>Wrong URL.</strong> <code>{form.url}</code> is the merchant portal.
                        Booking will return HTTP 405. Staging tokens use{' '}
                        <code>{COURIER_DEFAULT_API_URLS.postex_staging}</code>; production uses{' '}
                        <code>{COURIER_DEFAULT_API_URLS.postex}</code>.
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-warning mb-0 me-2"
                        onClick={applySuggestedApiUrl}
                        disabled={formBusy}
                      >
                        Use production API URL
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-warning mb-0"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            url: COURIER_DEFAULT_API_URLS.postex_staging,
                          }));
                          if (errors.url) setErrors((prev) => ({ ...prev, url: '' }));
                        }}
                        disabled={formBusy}
                      >
                        Use staging API URL
                      </button>
                    </div>
                  ) : form.type === 'postex' ? (
                    <p className="text-xs text-muted mb-0 mt-1">
                      Staging (stg-merchant) token →{' '}
                      <code>{COURIER_DEFAULT_API_URLS.postex_staging}</code>. Production token →{' '}
                      <code>{COURIER_DEFAULT_API_URLS.postex}</code>.
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 ms-1 align-baseline"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            url: COURIER_DEFAULT_API_URLS.postex_staging,
                          }));
                          if (errors.url) setErrors((prev) => ({ ...prev, url: '' }));
                        }}
                      >
                        Set staging URL
                      </button>
                    </p>
                  ) : null}
                  {errors.url && <div className="invalid-feedback d-block">{errors.url}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-login">
                    Login <span className="text-danger">*</span>
                  </label>
                  <input
                    id="courier-edit-login"
                    className={`form-control ${errors.login ? 'is-invalid' : ''}`}
                    value={form.login}
                    onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
                    disabled={formBusy}
                    autoComplete="username"
                  />
                  {errors.login && <div className="invalid-feedback">{errors.login}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-password">
                    Password
                  </label>
                  <input
                    id="courier-edit-password"
                    type="password"
                    className="form-control"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    disabled={formBusy}
                    autoComplete="new-password"
                    placeholder="Leave blank to keep current password"
                  />
                  <p className="text-xs text-muted mb-0 mt-1">
                    Leave blank to keep the existing password.
                  </p>
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-token">
                    Token {form.type === 'postex' ? <span className="text-danger">*</span> : null}
                  </label>
                  <input
                    id="courier-edit-token"
                    type="password"
                    className={`form-control ${errors.token ? 'is-invalid' : ''}`}
                    value={form.token}
                    onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value }))}
                    disabled={formBusy}
                    autoComplete="off"
                    placeholder={
                      form.type === 'postex'
                        ? 'Paste PostEx Merchant API Token'
                        : 'Leave blank to keep current token'
                    }
                  />
                  {form.type === 'postex' ? (
                    <p className="text-xs text-muted mb-0 mt-1">
                      Required for booking. Get it from PostEx merchant → API settings (not the portal
                      login password). Re-paste and Update if auth fails.
                    </p>
                  ) : (
                    <p className="text-xs text-muted mb-0 mt-1">
                      Leave blank to keep the existing token.
                    </p>
                  )}
                  {errors.token ? <div className="invalid-feedback d-block">{errors.token}</div> : null}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-account-no">
                    {form.type === 'postex' ? 'Pickup address code' : 'Account No'}
                    {form.type === 'postex' ? <span className="text-danger">*</span> : null}
                  </label>
                  <input
                    id="courier-edit-account-no"
                    type="text"
                    className={`form-control ${errors.account_no ? 'is-invalid' : ''}`}
                    value={form.account_no}
                    onChange={(e) => setForm((prev) => ({ ...prev, account_no: e.target.value }))}
                    disabled={formBusy}
                    placeholder={
                      form.type === 'postex' ? 'e.g. 001' : 'Optional TCS account number'
                    }
                  />
                  {form.type === 'postex' ? (
                    <p className="text-xs text-muted mb-0 mt-1">
                      PostEx requires <code>pickupAddressCode</code> or <code>storeAddressCode</code>.
                      Your staging merchant address code is usually <code>001</code> (from PostEx
                      merchant addresses). Save it here so booking can send it.
                    </p>
                  ) : null}
                  {errors.account_no ? (
                    <div className="invalid-feedback d-block">{errors.account_no}</div>
                  ) : null}
                </div>
                <div className="mb-4">
                  <label className="form-label" htmlFor="courier-edit-status">
                    Status
                  </label>
                  <select
                    id="courier-edit-status"
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={formBusy}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                {testResult ? (
                  <div
                    className={`alert py-2 ${testResult.ok ? 'alert-success' : 'alert-danger'}`}
                    role="status"
                  >
                    {testResult.message}
                  </div>
                ) : null}
                {(errors.submit || updateError) && (
                  <div className="alert alert-danger py-2">{errors.submit || updateError}</div>
                )}
                <div className="d-flex justify-content-end flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/courier-integration')}
                    disabled={formBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={handleTestCredentials}
                    disabled={formBusy}
                  >
                    {isTesting ? 'Checking…' : 'Check Credentials'}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={formBusy}>
                    {isSubmitting ? 'Updating…' : 'Update'}
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

export default CourierIntegrationEdit;
