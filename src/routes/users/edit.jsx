import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import {
  fetchUserById,
  updateUser,
  clearFetchStatus,
  clearUpdateStatus,
} from '../../features/users/usersSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const MODULES = ['category', 'integration', 'order', 'process', 'proces'];
const ACTIONS = ['view', 'add', 'edit', 'delete'];

const normalizePermissions = (input) => {
  const base = MODULES.reduce((acc, moduleName) => {
    acc[moduleName] = ACTIONS.reduce((obj, action) => {
      obj[action] = false;
      return obj;
    }, {});
    return acc;
  }, {});
  if (!input || typeof input !== 'object') return base;
  MODULES.forEach((moduleName) => {
    ACTIONS.forEach((action) => {
      base[moduleName][action] = Boolean(input?.[moduleName]?.[action]);
    });
  });
  return base;
};

const EditUser = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = usePermissions('users');
  const { currentUser, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.users
  );
  const isSubmitting = updateStatus === 'loading';
  const isLoading = fetchStatus === 'loading';

  const [form, setForm] = useState({
    name: '',
    email: '',
    status: 'active',
    role: ['USER'],
    permissions: normalizePermissions(null),
  });
  const [errors, setErrors] = useState({});

  const roleOptions = useMemo(() => ['USER', 'ADMIN', 'VENDOR', 'CUSTOMER'], []);

  useEffect(() => {
    if (canEdit === false) navigate('/users');
  }, [canEdit, navigate]);

  useEffect(() => {
    if (id) dispatch(fetchUserById(id));
    return () => {
      dispatch(clearFetchStatus());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!currentUser) return;
    setForm({
      name: currentUser.name || '',
      email: currentUser.email || '',
      status: currentUser.status || 'active',
      role: Array.isArray(currentUser.role)
        ? currentUser.role
        : currentUser.role
          ? [currentUser.role]
          : ['USER'],
      permissions: normalizePermissions(currentUser.permissions),
    });
  }, [currentUser]);

  const showToast = (toastId, body) => {
    const toastElement = document.getElementById(toastId);
    if (!toastElement) return;
    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) timeElement.textContent = moment().format('h:mm A');
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
    if (!Array.isArray(form.role) || form.role.length === 0) nextErrors.role = 'Select at least one role';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRoleToggle = (roleName) => {
    setForm((prev) => {
      const hasRole = prev.role.includes(roleName);
      const nextRole = hasRole ? prev.role.filter((item) => item !== roleName) : [...prev.role, roleName];
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
      await dispatch(
        updateUser({
          userId: id,
          payload: {
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
            permissions: form.permissions,
            status: form.status,
          },
        })
      ).unwrap();
      showToast('successToast', 'User updated successfully.');
      setTimeout(() => navigate('/users'), 800);
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.message || 'Failed to update user';
      showToast('dangerToast', message);
    }
  };

  if (isLoading) {
    return (
      <div className="container-fluid py-4">
        <div className="card">
          <div className="card-body text-center p-4">Loading user data...</div>
        </div>
      </div>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4">
        <div className="card">
          <div className="card-body">
            <div className="alert alert-danger mb-3">{fetchError || 'Failed to load user.'}</div>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/users')}>
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="card-header pb-0 d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-0">Edit User</h5>
                <p className="text-sm mb-0">Update role and permissions for this user.</p>
              </div>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate('/users')}>
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
                          id={`edit-role-${roleName}`}
                          disabled={isSubmitting}
                        />
                        <label className="form-check-label" htmlFor={`edit-role-${roleName}`}>
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

                {updateError && <div className="alert alert-danger py-2">{updateError}</div>}

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
                    {isSubmitting ? 'Updating...' : 'Update User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="position-fixed bottom-1 end-1 z-index-2">
        <div className="toast fade hide p-2 bg-white" role="alert" id="successToast" aria-atomic="true">
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">User updated successfully.</div>
        </div>
        <div className="toast fade hide p-2 mt-2 bg-white" role="alert" id="dangerToast" aria-atomic="true">
          <div className="toast-header border-0">
            <i className="ni ni-notification-70 text-danger me-2"></i>
            <span className="me-auto text-gradient text-danger font-weight-bold">Error</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Failed to update user.</div>
        </div>
      </div>
    </div>
  );
};

export default EditUser;
