import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setName } from '../features/user/userSlice.js';

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: ''
};

const SignUp = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.fullName.trim() || !form.email || !form.password || !form.confirmPassword) {
      setError('Please complete all fields.');
      return;
    }
    if (!form.email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords must match.');
      return;
    }

    dispatch(setName(form.fullName.trim()));
    setForm(initialForm);
    navigate('/profile');
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

            {error && <p className="error">{error}</p>}

            <button type="submit" className="cta-btn">
              Sign Up
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

