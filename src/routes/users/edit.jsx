import { useEffect, useMemo, useRef, useState } from 'react';
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
import { digitsOnlyFromPhone, isUserUploadFilePart } from '../../features/users/usersAPI.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { PERMISSION_ACTIONS, PERMISSION_MODULE_KEYS } from '../../constants/permissionModules.js';
import './user-form.css';

const normalizePermissions = (input) => {
  const base = PERMISSION_MODULE_KEYS.reduce((acc, moduleName) => {
    acc[moduleName] = PERMISSION_ACTIONS.reduce((obj, action) => {
      obj[action] = false;
      return obj;
    }, {});
    return acc;
  }, {});
  if (!input || typeof input !== 'object') return base;
  PERMISSION_MODULE_KEYS.forEach((moduleName) => {
    PERMISSION_ACTIONS.forEach((action) => {
      base[moduleName][action] = Boolean(input?.[moduleName]?.[action]);
    });
  });
  return base;
};

const buildBulkPermissions = (allGranted) =>
  PERMISSION_MODULE_KEYS.reduce((acc, moduleName) => {
    acc[moduleName] = PERMISSION_ACTIONS.reduce((obj, action) => {
      obj[action] = allGranted;
      return obj;
    }, {});
    return acc;
  }, {});

const pickUserProfileImageUrl = (user) => {
  if (!user || typeof user !== 'object') return '';
  const raw =
    user.profile_image ?? user.profileImage ?? user.avatar ?? user.image ?? user.photo ?? '';
  return resolveCategoryMediaUrl(raw);
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
    phone: '',
    password: '',
    initial_balance: '0',
    status: 'active',
    role: ['USER'],
    permissions: normalizePermissions(null),
  });
  const [errors, setErrors] = useState({});
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [existingProfileImageUrl, setExistingProfileImageUrl] = useState('');
  const profileImageInputRef = useRef(null);

  const roleOptions = useMemo(() => ['USER', 'ADMIN', 'VENDOR', 'CUSTOMER'], []);

  const allPermissionsGranted = useMemo(
    () =>
      PERMISSION_MODULE_KEYS.every((moduleName) =>
        PERMISSION_ACTIONS.every((action) => Boolean(form.permissions[moduleName]?.[action]))
      ),
    [form.permissions]
  );

  const noPermissionsGranted = useMemo(
    () =>
      PERMISSION_MODULE_KEYS.every((moduleName) =>
        PERMISSION_ACTIONS.every((action) => !form.permissions[moduleName]?.[action])
      ),
    [form.permissions]
  );

  useEffect(() => {
    return () => {
      if (profileImagePreview && profileImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(profileImagePreview);
      }
    };
  }, [profileImagePreview]);

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
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      initial_balance: '0',
      status: 'active',
      role: ['USER'],
      permissions: normalizePermissions(null),
    });
    setErrors({});
    setExistingProfileImageUrl('');
    setProfileImageFile(null);
    setProfileImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (profileImageInputRef.current) profileImageInputRef.current.value = '';
  }, [id]);

  useEffect(() => {
    if (!currentUser || !id) return;
    const currentId = String(currentUser._id || currentUser.id || '');
    if (currentId !== String(id)) return;
    setForm({
      name: currentUser.name || '',
      email: currentUser.email || '',
      phone: digitsOnlyFromPhone(
        currentUser.mobile || currentUser.phone || currentUser.phoneNumber || ''
      ),
      password: '',
      initial_balance:
        currentUser.initial_balance ??
        currentUser.initialBalance ??
        currentUser.opening_balance ??
        0,
      status: currentUser.status || 'active',
      role: Array.isArray(currentUser.role)
        ? currentUser.role
        : currentUser.role
          ? [currentUser.role]
          : ['USER'],
      permissions: normalizePermissions(currentUser.permissions),
    });
    setExistingProfileImageUrl(pickUserProfileImageUrl(currentUser));
    setProfileImageFile(null);
    setProfileImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (profileImageInputRef.current) profileImageInputRef.current.value = '';
  }, [currentUser, id]);

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setProfileImageFile(null);
      setProfileImagePreview((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, profile_image: 'Please choose an image file' }));
      return;
    }
    setErrors((prev) => ({ ...prev, profile_image: '' }));
    setProfileImageFile(file);
    setProfileImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearProfileImage = () => {
    setProfileImageFile(null);
    setProfileImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setErrors((prev) => ({ ...prev, profile_image: '' }));
    if (profileImageInputRef.current) profileImageInputRef.current.value = '';
  };

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
    const emailTrim = form.email.trim();
    if (emailTrim && !/^\S+@\S+\.\S+$/.test(emailTrim)) {
      nextErrors.email = 'Enter a valid email address';
    }
    const phoneDigits = digitsOnlyFromPhone(form.phone);
    if (!phoneDigits) {
      nextErrors.phone = 'Phone is required';
    } else if (phoneDigits.length < 7) {
      nextErrors.phone = 'Enter a valid phone number (at least 7 digits)';
    } else if (phoneDigits.length > 11) {
      nextErrors.phone = 'Phone number must be 11 digits or less';
    }
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

  const setAllPermissions = (granted) => {
    setForm((prev) => ({
      ...prev,
      permissions: buildBulkPermissions(granted),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const loadedId = String(currentUser?._id || currentUser?.id || '');
    if (!loadedId || loadedId !== String(id || '')) {
      showToast('dangerToast', 'User data is still loading. Please wait and try again.');
      return;
    }
    try {
      const parsedInitialBalance = parseFloat(String(form.initial_balance).replace(/,/g, ''));
      const initial_balance = Number.isFinite(parsedInitialBalance) ? parsedInitialBalance : 0;
      await dispatch(
        updateUser({
          userId: id,
          payload: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: digitsOnlyFromPhone(form.phone),
            password: form.password,
            initial_balance,
            role: form.role,
            permissions: form.permissions,
            status: form.status,
            profile_image: isUserUploadFilePart(profileImageFile) ? profileImageFile : undefined,
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
      <div className="user-form-page">
        <div className="user-form-card card">
          <div className="card-body text-center p-5">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
            <div className="text-muted">Loading user data…</div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="user-form-page">
        <div className="user-form-card card">
          <div className="card-body p-4">
            <div className="alert alert-danger mb-3">
              {fetchError || 'Failed to load user.'}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary mb-0"
              onClick={() => navigate('/users')}
            >
              Back to list
            </button>
          </div>
        </div>
      </div>
    );
  }

  const profileSrc = profileImagePreview || existingProfileImageUrl;

  return (
    <div className="user-form-page">
      <form onSubmit={handleSubmit}>
        <div className="user-form-card card">
          <div className="user-form-header">
            <div>
              <span className="user-form-eyebrow">
                <i className="fas fa-users" aria-hidden="true" />
                Users
              </span>
              <h5 className="user-form-title">Edit user</h5>
              <p className="user-form-subtitle">
                Update profile, roles, and permissions for{' '}
                <strong>{form.name || currentUser?.name || 'this user'}</strong>.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary mb-0"
              onClick={() => navigate('/users')}
            >
              <i className="fas fa-arrow-left me-1" aria-hidden="true" />
              Back to list
            </button>
          </div>

          <div className="user-form-body">
            <div className="row g-3">
              <div className="col-lg-4">
                <div className="user-photo-panel">
                  <div className="user-photo-frame">
                    {profileSrc ? (
                      <img src={profileSrc} alt="Profile" />
                    ) : (
                      <div className="user-photo-empty">
                        <i className="fas fa-user" aria-hidden="true" />
                        <span>No photo</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={profileImageInputRef}
                    id="user-profile-image"
                    type="file"
                    className="d-none"
                    accept="image/*"
                    onChange={handleProfileImageChange}
                    disabled={isSubmitting}
                  />
                  <div className="d-flex gap-2 flex-wrap justify-content-center">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary mb-0"
                      onClick={() => profileImageInputRef.current?.click()}
                      disabled={isSubmitting}
                    >
                      <i className="fas fa-upload me-1" aria-hidden="true" />
                      {profileSrc ? 'Change photo' : 'Upload photo'}
                    </button>
                    {profileImagePreview ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mb-0"
                        onClick={clearProfileImage}
                        disabled={isSubmitting}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {errors.profile_image ? (
                    <div className="text-danger small mt-2">{errors.profile_image}</div>
                  ) : null}
                  <p className="user-photo-hint">
                    Optional. Saved as <code className="text-xs">profile_image</code>.
                  </p>
                </div>
              </div>

              <div className="col-lg-8">
                <div className="user-form-section mb-0 h-100">
                  <div className="user-form-section-title">
                    <i className="fas fa-id-card text-primary" aria-hidden="true" />
                    Account details
                  </div>
                  <p className="user-form-section-hint">Basic profile and login information.</p>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="user-form-label d-block" htmlFor="user-edit-name">
                        Name <span className="req">*</span>
                      </label>
                      <input
                        id="user-edit-name"
                        className={`form-control user-form-control ${errors.name ? 'is-invalid' : ''}`}
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        disabled={isSubmitting}
                      />
                      {errors.name ? <div className="invalid-feedback">{errors.name}</div> : null}
                    </div>
                    <div className="col-md-6">
                      <label className="user-form-label d-block" htmlFor="user-edit-email">
                        Email
                      </label>
                      <input
                        id="user-edit-email"
                        type="email"
                        className={`form-control user-form-control ${errors.email ? 'is-invalid' : ''}`}
                        value={form.email}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                        disabled={isSubmitting}
                      />
                      {errors.email ? <div className="invalid-feedback">{errors.email}</div> : null}
                    </div>
                    <div className="col-md-6">
                      <label className="user-form-label d-block" htmlFor="user-edit-phone">
                        Phone <span className="req">*</span>
                      </label>
                      <input
                        id="user-edit-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        className={`form-control user-form-control ${errors.phone ? 'is-invalid' : ''}`}
                        value={form.phone}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            phone: digitsOnlyFromPhone(e.target.value).slice(0, 11),
                          }))
                        }
                        placeholder="Digits only"
                        autoComplete="tel"
                        disabled={isSubmitting}
                      />
                      {errors.phone ? <div className="invalid-feedback">{errors.phone}</div> : null}
                    </div>
                    <div className="col-md-6">
                      <label className="user-form-label d-block" htmlFor="user-edit-password">
                        Password
                      </label>
                      <input
                        id="user-edit-password"
                        type="password"
                        className="form-control user-form-control"
                        value={form.password}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, password: e.target.value }))
                        }
                        placeholder="Leave blank to keep current"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                      />
                      <small className="user-form-help">Leave empty to keep the current password.</small>
                    </div>
                    <div className="col-md-6">
                      <label className="user-form-label d-block" htmlFor="user-edit-balance">
                        Initial balance
                      </label>
                      <input
                        id="user-edit-balance"
                        type="number"
                        className="form-control user-form-control"
                        step="0.01"
                        value={form.initial_balance}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, initial_balance: e.target.value }))
                        }
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="user-form-label d-block" htmlFor="user-edit-status">
                        Status
                      </label>
                      <select
                        id="user-edit-status"
                        className="form-select user-form-control"
                        value={form.status}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, status: e.target.value }))
                        }
                        disabled={isSubmitting}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="user-form-section mt-3">
              <div className="user-form-section-title">
                <i className="fas fa-user-tag text-primary" aria-hidden="true" />
                Roles
              </div>
              <p className="user-form-section-hint">Select one or more roles for this user.</p>
              <div className="user-role-chips">
                {roleOptions.map((roleName) => {
                  const active = form.role.includes(roleName);
                  return (
                    <label
                      key={roleName}
                      className={`user-role-chip ${active ? 'is-active' : ''}`}
                      htmlFor={`edit-role-${roleName}`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => handleRoleToggle(roleName)}
                        id={`edit-role-${roleName}`}
                        disabled={isSubmitting}
                      />
                      {roleName}
                    </label>
                  );
                })}
              </div>
              {errors.role ? <small className="text-danger d-block mt-2">{errors.role}</small> : null}
            </div>

            <div className="user-form-section">
              <div className="user-form-section-title">
                <i className="fas fa-shield-halved text-primary" aria-hidden="true" />
                Permissions
              </div>
              <p className="user-form-section-hint">
                Grant module access. V = view, A = add, E = edit, D = delete.
              </p>

              <div className="user-perm-toolbar">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="give-all-permissions"
                    checked={allPermissionsGranted}
                    onChange={(e) => setAllPermissions(e.target.checked)}
                    disabled={isSubmitting}
                  />
                  <label className="form-check-label text-sm" htmlFor="give-all-permissions">
                    Grant all permissions
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="remove-all-permissions"
                    checked={noPermissionsGranted}
                    onChange={(e) => {
                      if (e.target.checked) setAllPermissions(false);
                    }}
                    disabled={isSubmitting}
                  />
                  <label className="form-check-label text-sm" htmlFor="remove-all-permissions">
                    Remove all permissions
                  </label>
                </div>
              </div>

              <div className="user-perm-table-wrap">
                <table className="table user-perm-table mb-0">
                  <thead>
                    <tr>
                      <th>Module</th>
                      {PERMISSION_ACTIONS.map((action) => (
                        <th key={action}>{action}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_MODULE_KEYS.map((moduleName) => (
                      <tr key={moduleName}>
                        <td>
                          <span className="user-perm-module">{moduleName}</span>
                        </td>
                        {PERMISSION_ACTIONS.map((action) => (
                          <td key={`${moduleName}-${action}`}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={Boolean(form.permissions[moduleName]?.[action])}
                              onChange={() => handlePermissionToggle(moduleName, action)}
                              disabled={isSubmitting}
                              aria-label={`${moduleName} ${action}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {updateError ? (
              <div className="alert alert-danger py-2 mt-3 mb-0">{updateError}</div>
            ) : null}
          </div>

          <div className="user-form-footer">
            <span className="user-form-footer-note">
              <span className="req text-danger">*</span> Required fields
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary mb-0"
              onClick={() => navigate('/users')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary mb-0" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                  Updating…
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2" aria-hidden="true" />
                  Update user
                </>
              )}
            </button>
          </div>
        </div>
      </form>

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
          <div className="toast-body">User updated successfully.</div>
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
          <div className="toast-body">Failed to update user.</div>
        </div>
      </div>
    </div>
  );
};

export default EditUser;
