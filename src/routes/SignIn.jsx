import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setName } from '../features/user/userSlice.js';

const initialForm = {
  email: '',
  password: ''
};

const SignIn = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.email || !form.password) {
      setError('Please fill in both email and password.');
      return;
    }
    if (!form.email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    const displayName = form.email.split('@')[0] || 'User';
    dispatch(setName(displayName));
    setForm(initialForm);
    navigate('/profile');
  };

  return (
    <section className="card auth-card">
      <h2>Sign In</h2>
      <p className="muted">Use any email to simulate signing in.</p>
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
        {error && <p className="error">{error}</p>}
        <button type="submit">Sign In</button>
      </form>
      <p className="muted">Successful sign-in routes you to the Profile page.</p>
    </section>
  );
};

export default SignIn;

