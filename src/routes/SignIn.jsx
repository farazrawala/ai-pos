import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setLoginSession } from '../features/user/userSlice.js';
import { extractCompanyFromUser } from '../features/company/companyAPI.js';
import { triggerMasterSyncAfterLogin } from '../offline/masterSync.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { hasCachedAuthSession, OFFLINE_SIGN_IN_MESSAGE } from '../utils/offlineAuth.js';
import apiClient from '../api/apiClient.js';
import { API_BASE_URL } from '../config/apiConfig.js';
import { APP_NAME } from '../config/env.js';

const initialForm = {
  email: '',
  password: '',
  remember: false,
};

const SignIn = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const hasCachedSession = hasCachedAuthSession();
  const offlineSignInBlocked = !isOnline && !hasCachedSession;
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (offlineSignInBlocked) {
      setError(OFFLINE_SIGN_IN_MESSAGE);
      return;
    }
    if (!form.email || !form.password) {
      setError('Please fill in both email and password.');
      return;
    }
    if (!form.email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    try {
      setStatus('pending');
      const { data } = await apiClient.post(
        '/user/login',
        {
          email: form.email,
          password: form.password,
        },
        {
          baseURL: API_BASE_URL,
        }
      );

      if (data?.user) {
        const userData = { ...data.user };
        if (!userData.token) {
          userData.token = data.token || data.access_token || data.accessToken || userData.token;
        }
        dispatch(setLoginSession({ ...data, user: userData }));
        triggerMasterSyncAfterLogin(userData, extractCompanyFromUser(userData));
      } else if (data?._id || data?.email) {
        const userData = { ...data };
        if (!userData.token) {
          userData.token = data.token || data.access_token || data.accessToken;
        }
        dispatch(setLoginSession({ success: true, user: userData }));
        triggerMasterSyncAfterLogin(userData, extractCompanyFromUser(userData));
      } else {
        const displayName =
          data?.name ||
          data?.user?.name ||
          data?.user?.fullName ||
          form.email.split('@')[0] ||
          'User';
        const token = data?.token || data?.access_token || data?.accessToken || data?.user?.token;
        const userData = { name: displayName, email: form.email, token };
        dispatch(
          setLoginSession({
            success: true,
            user: userData,
          })
        );
        triggerMasterSyncAfterLogin(userData, extractCompanyFromUser(userData));
      }

      setForm(initialForm);
      setStatus('completed');
      navigate('/profile');
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to sign in. Please verify your credentials.';
      setError(message);
      setStatus('failed');
    }
  };

  return (
    <section className="signin-page">
      <div className="signin-hero">
        <span className="signin-mask" />
      </div>
      <div className="signin-content">
        <div className="signin-card">
          <header className="signin-card-header">
            <h2>{APP_NAME}</h2>
            <p className="muted">Sign in with your email credentials</p>
          </header>

          <div className="signin-divider">
            <span>Credentials</span>
          </div>

          {offlineSignInBlocked && (
            <div className="alert alert-warning py-2 small mb-3" role="alert">
              {OFFLINE_SIGN_IN_MESSAGE}
            </div>
          )}

          {hasCachedSession && !isOnline && (
            <div className="alert alert-info py-2 small mb-3" role="status">
              You are offline. Open{' '}
              <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => navigate('/pos')}>
                POS
              </button>{' '}
              to continue with cached data.
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />

            <label className="form-switch">
              <input
                type="checkbox"
                name="remember"
                checked={form.remember}
                onChange={handleChange}
              />
              <span className="switch-slider" />
              Remember me
            </label>

            {error && <p className="error">{error}</p>}

            <button type="submit" className="cta-btn" disabled={status === 'pending' || offlineSignInBlocked}>
              {status === 'pending' ? 'Signing In...' : 'Sign In'}
            </button>
            <button type="button" className="ghost-btn" onClick={() => navigate('/signup')}>
              Create account
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default SignIn;
