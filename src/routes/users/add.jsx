import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { createUser, clearCreateStatus } from '../../features/users/usersSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const MODULES = ['category', 'integration', 'order', 'process', 'proces'];
const ACTIONS = ['view', 'add', 'edit', 'delete'];

const buildInitialPermissions = () =>
  MODULES.reduce((acc, moduleName) => {
    acc[moduleName] = ACTIONS.reduce((obj, action) => {
      obj[action] = false;
      return obj;
    }, {});
    return acc;
  }, {});

const AddUser = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { canCreate } = usePermissions('users');
  const { createStatus, createError } = useSelector((state) => state.users);
  const isSubmitting = createStatus === 'loading';

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    status: 'active',
    role: ['USER'],
    permissions: buildInitialPermissions(),
  });
  const [errors, setErrors] = useState({});

  const roleOptions = useMemo(() => ['USER', 'ADMIN', 'VENDOR', 'CUSTOMER'], []);

  useEffect(() => {
    if (canCreate === false) navigate('/users');
  }, [canCreate, navigate]);

  const showToast = (toastId, body) => {
    const toastElement = document.getElementById(toastId);
    if (!toastElement) return;
    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) {
      timeElement.textContent = moment().format('h:mm A');
    }
    if (body) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = body;
    }
    if (window.bootstrap?.Toast) {
      const toast = new window.bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
      toast.show();
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (!form.email.trim()) nextErrors.email = 'Email is required';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = 'Valid email is required';
    if (!form.password.trim()) nextErrors.password = 'Password is required';
    if (!Array.isArray(form.role) || form.role.length === 0)
      nextErrors.role = 'Select at least one role';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRoleToggle = (roleName) => {
    setForm((prev) => {
      const hasRole = prev.role.includes(roleName);
      const nextRole = hasRole
        ? prev.role.filter((item) => item !== roleName)
        : [...prev.role, roleName];
      return { ...prev, role: nextRole };
    });
  };

  const handlePermissionToggle = (moduleName, actionName) => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleName]: {
          ...prev.permissions[moduleName],
          [actionName]: !prev.permissions[moduleName][actionName],
        },
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      console.log('[Users module] create payload debug', {
        company_id: form.company_id || null,
        role: form.role,
        email: form.email?.trim?.() || '',
      });
      await dispatch(
        createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          permissions: form.permissions,
          status: form.status,
        })
      ).unwrap();

      showToast('successToast', 'User created successfully.');
      dispatch(clearCreateStatus());
      setTimeout(() => navigate('/users'), 800);
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.message || 'Failed to create user';
      showToast('dangerToast', message);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="card-header pb-0 d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-0">Add User</h5>
                <p className="text-sm mb-0">Create a user with roles and module permissions.</p>
              </div>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => navigate('/users')}
              >
                Back to List
              </button>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-md-6 mb-3">
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
                  <div className="col-md-6 mb-3">
                    <label className="form-label">
                      Email <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      disabled={isSubmitting}
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">
                      Password <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      disabled={isSubmitting}
                    />
                    {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                  </div>
                  <div className="col-md-6 mb-3">
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
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Roles <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex flex-wrap gap-3">
                    {roleOptions.map((roleName) => (
                      <div className="form-check" key={roleName}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={form.role.includes(roleName)}
                          onChange={() => handleRoleToggle(roleName)}
                          id={`role-${roleName}`}
                          disabled={isSubmitting}
                        />
                        <label className="form-check-label" htmlFor={`role-${roleName}`}>
                          {roleName}
                        </label>
                      </div>
                    ))}
                  </div>
                  {errors.role && <small className="text-danger">{errors.role}</small>}
                </div>

                <div className="mb-4">
                  <label className="form-label">Permissions</label>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Module</th>
                          {ACTIONS.map((action) => (
                            <th key={action} className="text-uppercase text-xs">
                              {action}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MODULES.map((moduleName) => (
                          <tr key={moduleName}>
                            <td className="text-uppercase text-xs fw-bold">{moduleName}</td>
                            {ACTIONS.map((action) => (
                              <td key={`${moduleName}-${action}`}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(form.permissions[moduleName]?.[action])}
                                  onChange={() => handlePermissionToggle(moduleName, action)}
                                  disabled={isSubmitting}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {createError && <div className="alert alert-danger py-2">{createError}</div>}

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/users')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create User'}
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
          id="successToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">User created successfully.</div>
        </div>
        <div
          className="toast fade hide p-2 mt-2 bg-white"
          role="alert"
          id="dangerToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-notification-70 text-danger me-2"></i>
            <span className="me-auto text-gradient text-danger font-weight-bold">Error</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Failed to create user.</div>
        </div>
      </div>
    </div>
  );
};

export default AddUser;
