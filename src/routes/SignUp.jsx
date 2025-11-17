import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setName } from '../features/user/userSlice.js';
import apiClient from '../api/apiClient.js';

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  address: '',
  companyEmail: ''
};

const SignUp = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (
      !form.fullName.trim() ||
      !form.email ||
      !form.password ||
      !form.confirmPassword ||
      !form.companyName.trim() ||
      !form.address.trim() ||
      !form.companyEmail
    ) {
      setError('Please complete all fields.');
      return;
    }
    if (!form.email.includes('@') || !form.companyEmail.includes('@')) {
      setError('Enter valid email addresses.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords must match.');
      return;
    }

    try {
      setStatus('pending');
      await apiClient.post(
        '/user/user_company',
        {
          name: form.fullName.trim(),
          email: form.email,
          password: form.password,
          company_name: form.companyName.trim(),
          address: form.address.trim(),
          company_email: form.companyEmail
        },
        {
          baseURL: 'http://localhost:8000/api'
        }
      );

      dispatch(setName(form.fullName.trim()));
      setForm(initialForm);
      setStatus('completed');
      navigate('/profile');
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to sign up. Please try again.';
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
            <h2>Create Account</h2>
            <p className="muted">Fill in the details below to set up your profile</p>
          </header>

          <div className="signin-divider">
            <span>Details</span>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              type="text"
              name="fullName"
              placeholder="Jane Doe"
              value={form.fullName}
              onChange={handleChange}
              required
            />
            <label htmlFor="signupEmail">Email</label>
            <input
              id="signupEmail"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
            <label htmlFor="signupPassword">Password</label>
            <input
              id="signupPassword"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />
            <label htmlFor="companyName">Company name</label>
            <input
              id="companyName"
              type="text"
              name="companyName"
              placeholder="Gmail 1"
              value={form.companyName}
              onChange={handleChange}
              required
            />
            <label htmlFor="address">Address</label>
            <input
              id="address"
              type="text"
              name="address"
              placeholder="New York"
              value={form.address}
              onChange={handleChange}
              required
            />
            <label htmlFor="companyEmail">Company email</label>
            <input
              id="companyEmail"
              type="email"
              name="companyEmail"
              placeholder="company@gmail.com"
              value={form.companyEmail}
              onChange={handleChange}
              required
            />

            {error && <p className="error">{error}</p>}

            <button type="submit" className="cta-btn" disabled={status === 'pending'}>
              {status === 'pending' ? 'Creating Account...' : 'Sign Up'}
            </button>
            <button type="button" className="ghost-btn" onClick={() => navigate('/signin')}>
              Already have an account?
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default SignUp;

