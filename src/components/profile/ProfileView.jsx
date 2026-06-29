import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { setUser, selectAuthUser } from '../../features/user/userSlice.js';
import {
  digitsOnlyFromPhone,
  fetchUserByIdRequest,
  isUserUploadFilePart,
  pickUserProfileImageUrl,
  updateProfileRequest,
} from '../../features/users/usersAPI.js';

export default function ProfileView() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authUser = useSelector(selectAuthUser);
  const sessionToken = useSelector((state) => state.user.token);

  const userId = authUser?._id || authUser?.id || '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [userRole, setUserRole] = useState('');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [existingProfileImageUrl, setExistingProfileImageUrl] = useState('');
  const profileImageInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (profileImagePreview && profileImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(profileImagePreview);
      }
    };
  }, [profileImagePreview]);

  const applyUserToForm = useCallback((user) => {
    if (!user) return;
    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: digitsOnlyFromPhone(user.mobile || user.phone || user.phoneNumber || ''),
      password: '',
      confirmPassword: '',
    });
    const roleList = Array.isArray(user.role) ? user.role : user.role ? [user.role] : [];
    setUserRole(roleList.map((r) => String(r)).join(', '));
    setExistingProfileImageUrl(pickUserProfileImageUrl(user));
    setProfileImageFile(null);
    setProfileImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (profileImageInputRef.current) profileImageInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setLoadError('No logged-in user found.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError('');

    fetchUserByIdRequest(userId)
      .then((user) => {
        if (!cancelled) {
          applyUserToForm(user);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err?.message || 'Could not refresh profile.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, applyUserToForm]);

  const showToast = (toastId, body) => {
    const toastElement = document.getElementById(toastId);
    if (!toastElement) return;
    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) timeElement.textContent = moment().format('h:mm A');
    if (body) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = body;
    }
    const ToastApi = window.bootstrap?.Toast;
    if (ToastApi) {
      const instance = ToastApi.getOrCreateInstance(toastElement, {
        autohide: true,
        delay: 5000,
      });
      instance.show();
      return;
    }
    toastElement.classList.remove('hide');
    toastElement.classList.add('show');
    setTimeout(() => {
      toastElement.classList.remove('show');
      toastElement.classList.add('hide');
    }, 5000);
  };

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

  const validateForm = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    const emailTrim = form.email.trim();
    if (!emailTrim) {
      nextErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(emailTrim)) {
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
    if (form.password || form.confirmPassword) {
      if (form.password.length < 6) {
        nextErrors.password = 'Password must be at least 6 characters';
      }
      if (form.password !== form.confirmPassword) {
        nextErrors.confirmPassword = 'Passwords do not match';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !validateForm()) return;

    setSaving(true);
    setSaveError('');

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: digitsOnlyFromPhone(form.phone),
        profile_image: isUserUploadFilePart(profileImageFile) ? profileImageFile : undefined,
      };
      if (form.password.trim()) {
        payload.password = form.password;
      }

      const updated = await updateProfileRequest(userId, payload);
      const merged = {
        ...authUser,
        ...updated,
        token: sessionToken || authUser?.token,
      };
      dispatch(setUser(merged));
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      setExistingProfileImageUrl(pickUserProfileImageUrl(merged));
      if (isUserUploadFilePart(profileImageFile)) {
        setProfileImageFile(null);
        setProfileImagePreview((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return null;
        });
        if (profileImageInputRef.current) profileImageInputRef.current.value = '';
      }
      showToast('successToast', 'Profile updated successfully.');
    } catch (err) {
      const message = err?.message || 'Failed to update profile';
      setSaveError(message);
      showToast('dangerToast', message);
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className="card shadow-sm" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div className="card-body">
          <p className="mb-3">Please sign in to manage your profile.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/signin')}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card shadow-sm" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div className="card-body text-center p-4">Loading profile…</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-2">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className="card-header pb-3">
              <h5 className="mb-1">My profile</h5>
              <p className="text-sm text-muted mb-0">
                Update your name, contact details, photo, and password.
              </p>
            </div>
            <div className="card-body pt-0">
              {loadError ? (
                <div className="alert alert-warning py-2 text-sm">{loadError}</div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <div className="mb-4 text-center">
                  {profileImagePreview || existingProfileImageUrl ? (
                    <img
                      src={profileImagePreview || existingProfileImageUrl}
                      alt="Profile"
                      className="rounded-circle border mb-2"
                      style={{ width: '112px', height: '112px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className="d-inline-flex align-items-center justify-content-center rounded-circle border bg-light text-muted mb-2"
                      style={{ width: '112px', height: '112px' }}
                    >
                      No photo
                    </div>
                  )}
                  <div className="mx-auto" style={{ maxWidth: '360px' }}>
                    <input
                      ref={profileImageInputRef}
                      id="profile-image"
                      type="file"
                      className={`form-control form-control-sm ${errors.profile_image ? 'is-invalid' : ''}`}
                      accept="image/*"
                      onChange={handleProfileImageChange}
                      disabled={saving}
                    />
                    <small className="text-muted d-block mt-1">
                      Field: <code className="text-xs">profile_image</code>
                    </small>
                    {errors.profile_image ? (
                      <div className="invalid-feedback d-block">{errors.profile_image}</div>
                    ) : null}
                    {profileImagePreview ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mt-2"
                        onClick={clearProfileImage}
                        disabled={saving}
                      >
                        Remove new photo
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="profile-name">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="profile-name"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={saving}
                  />
                  {errors.name ? <div className="invalid-feedback">{errors.name}</div> : null}
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="profile-email">
                    Email <span className="text-danger">*</span>
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    disabled={saving}
                  />
                  {errors.email ? <div className="invalid-feedback">{errors.email}</div> : null}
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="profile-phone">
                    Phone <span className="text-danger">*</span>
                  </label>
                  <input
                    id="profile-phone"
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
                    disabled={saving}
                  />
                  {errors.phone ? <div className="invalid-feedback">{errors.phone}</div> : null}
                </div>

                <div className="mb-3">
                  <label className="form-label">Role</label>
                  <p className="form-control-static mb-0 fw-semibold">
                    {userRole || '—'}
                  </p>
                  <small className="text-muted d-block mt-1">
                    Your role is assigned by an administrator and cannot be changed here.
                  </small>
                </div>

                <hr className="horizontal dark my-4" />
                <h6 className="text-sm text-uppercase text-muted mb-3">Change password</h6>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label" htmlFor="profile-password">
                      New password
                    </label>
                    <input
                      id="profile-password"
                      type="password"
                      className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                      value={form.password}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      placeholder="Leave blank to keep current"
                      autoComplete="new-password"
                      disabled={saving}
                    />
                    {errors.password ? (
                      <div className="invalid-feedback">{errors.password}</div>
                    ) : null}
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label" htmlFor="profile-confirm-password">
                      Confirm password
                    </label>
                    <input
                      id="profile-confirm-password"
                      type="password"
                      className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                      value={form.confirmPassword}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                      }
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                      disabled={saving}
                    />
                    {errors.confirmPassword ? (
                      <div className="invalid-feedback">{errors.confirmPassword}</div>
                    ) : null}
                  </div>
                </div>

                {saveError ? <div className="alert alert-danger py-2">{saveError}</div> : null}

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/dashboard')}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div
        className="toast-container position-fixed bottom-0 end-0 p-3"
        style={{ zIndex: 1090 }}
      >
        <div
          className="toast fade hide p-2 bg-white"
          role="alert"
          id="successToast"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Profile updated successfully.</div>
        </div>
        <div
          className="toast fade hide p-2 mt-2 bg-white"
          role="alert"
          id="dangerToast"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-notification-70 text-danger me-2"></i>
            <span className="me-auto text-gradient text-danger font-weight-bold">Error</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Failed to update profile.</div>
        </div>
      </div>
    </div>
  );
}
