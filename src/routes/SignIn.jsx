import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setUser } from '../features/user/userSlice.js';
import apiClient from '../api/apiClient.js';
import { API_BASE_URL } from '../config/apiConfig.js';

const initialForm = {
  email: '',
  password: '',
  remember: false,
};

const SignIn = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
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

      // Save complete user data from response
      // The API returns user data in data.user or directly in data
      const userData = data?.user || data;

      if (userData) {
        // Ensure token is included in user data
        if (!userData.token) {
          userData.token = data?.token || data?.access_token || data?.accessToken;
        }

        // Save complete user object to Redux and localStorage
        dispatch(setUser(userData));
      } else {
        // Fallback: if user data structure is different, extract what we can
        const displayName =
          data?.name ||
          data?.user?.name ||
          data?.user?.fullName ||
          form.email.split('@')[0] ||
          'User';

        const token = data?.token || data?.access_token || data?.accessToken || data?.user?.token;

        dispatch(
          setUser({
            name: displayName,
            email: form.email,
            token: token,
          })
        );
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
            <h2>POS Sign in</h2>
            <p className="muted">Sign in with your email credentials</p>
          </header>

          <div className="signin-divider">
            <span>Credentials</span>
          </div>

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

            <button type="submit" className="cta-btn" disabled={status === 'pending'}>
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
