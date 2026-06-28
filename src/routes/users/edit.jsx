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
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="card-header pb-0 d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-0">Edit User</h5>
                <p className="text-sm mb-0">Update role and permissions for this user.</p>
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
                  <div className="col-md-4 mb-3">
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
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      disabled={isSubmitting}
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label" htmlFor="user-edit-phone">
                      Phone <span className="text-danger">*</span>
                    </label>
                    <input
                      id="user-edit-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
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
                    {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label className="form-label" htmlFor="user-edit-password">
                      Password
                    </label>
                    <input
                      id="user-edit-password"
                      type="password"
                      className="form-control"
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Leave blank to keep current"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Initial balance</label>
                    <input
                      type="number"
                      className="form-control"
                      step="0.01"
                      value={form.initial_balance}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, initial_balance: e.target.value }))
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
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
                  <label className="form-label" htmlFor="user-profile-image">
                    Profile photo
                  </label>
                  {existingProfileImageUrl && !profileImagePreview && (
                    <div className="mb-2">
                      <small className="text-muted d-block mb-1">Current photo:</small>
                      <img
                        src={existingProfileImageUrl}
                        alt="Current profile"
                        className="rounded-circle border d-block"
                        style={{ width: '96px', height: '96px', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  <input
                    ref={profileImageInputRef}
                    id="user-profile-image"
                    type="file"
                    className={`form-control ${errors.profile_image ? 'is-invalid' : ''}`}
                    accept="image/*"
                    onChange={handleProfileImageChange}
                    disabled={isSubmitting}
                  />
                  <small className="text-muted d-block">
                    Optional. Uploaded as field <code className="text-xs">profile_image</code>.
                  </small>
                  {errors.profile_image && (
                    <div className="invalid-feedback d-block">{errors.profile_image}</div>
                  )}
                  {profileImagePreview && (
                    <div className="mt-3 d-flex align-items-start gap-2">
                      <img
                        src={profileImagePreview}
                        alt="New profile preview"
                        className="rounded-circle border"
                        style={{ width: '96px', height: '96px', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={clearProfileImage}
                        disabled={isSubmitting}
                      >
                        Remove new photo
                      </button>
                    </div>
                  )}
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
                  <div className="d-flex flex-wrap gap-4 mb-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="give-all-permissions"
                        checked={allPermissionsGranted}
                        onChange={(e) => setAllPermissions(e.target.checked)}
                        disabled={isSubmitting}
                      />
                      <label className="form-check-label" htmlFor="give-all-permissions">
                        Check all rights
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
                      <label className="form-check-label" htmlFor="remove-all-permissions">
                        Remove all rights
                      </label>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Module</th>
                          {PERMISSION_ACTIONS.map((action) => (
                            <th key={action} className="text-uppercase text-xs">
                              {action}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_MODULE_KEYS.map((moduleName) => (
                          <tr key={moduleName}>
                            <td className="text-uppercase text-xs fw-bold">{moduleName}</td>
                            {PERMISSION_ACTIONS.map((action) => (
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
