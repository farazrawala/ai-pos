import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, X } from 'lucide-react';
import Button from '../Button/Button.jsx';
import GoogleAddressField from './GoogleAddressField.jsx';
import { useSignupModal } from '../../context/SignupModalContext.jsx';
import { DEFAULT_SIGNUP_PERMISSIONS, site } from '../../config.js';

const STEPS = [
  { id: 'account', label: 'Account', title: 'Your account', description: 'Create the master login for this company.' },
  { id: 'company', label: 'Company', title: 'Company details', description: 'Tell us about the business you are setting up.' },
];

const initialForm = {
  name: '',
  email: '',
  password: '',
  company_name: '',
  company_email: '',
  address: '',
  google_address: '',
  address_latitude: '',
  address_longitude: '',
};

function cloneForm() {
  return { ...initialForm };
}

export default function SignupModal() {
  const { open, closeSignup } = useSignupModal();
  const titleId = useId();
  const logoInputRef = useRef(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(cloneForm);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && status !== 'pending') closeSignup();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, closeSignup, status]);

  useEffect(() => {
    if (open) return;
    setStep(0);
    setForm(cloneForm());
    setLogoFile(null);
    setError('');
    setStatus('idle');
    setLogoPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return '';
    });
    if (logoInputRef.current) logoInputRef.current.value = '';
  }, [open]);

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for the logo.');
      return;
    }
    if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError('');
  };

  const clearLogo = () => {
    if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview('');
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const validateStep = (index) => {
    if (index === 0) {
      if (!form.name.trim() || !form.email.trim() || !form.password) {
        return 'Please complete all account fields.';
      }
      if (!form.email.includes('@')) return 'Enter a valid email address.';
      if (form.password.length < 6) return 'Password must be at least 6 characters.';
      return '';
    }
    if (index === 1) {
      if (!form.company_name.trim() || !form.company_email.trim() || !form.address.trim()) {
        return 'Please complete all company fields.';
      }
      if (!form.company_email.includes('@')) return 'Enter a valid company email.';
      return '';
    }
    return '';
  };

  const goNext = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isLast) {
      goNext();
      return;
    }

    const validationError = validateStep(0) || validateStep(1);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      company_name: form.company_name.trim(),
      address: form.address.trim(),
      company_email: form.company_email.trim(),
      permissions: structuredClone(DEFAULT_SIGNUP_PERMISSIONS),
    };

    if (form.google_address.trim()) {
      payload.google_address = form.google_address.trim();
    }
    if (form.address_latitude) {
      payload.address_latitude = String(form.address_latitude).trim();
    }
    if (form.address_longitude) {
      payload.address_longitude = String(form.address_longitude).trim();
    }

    try {
      setStatus('pending');
      setError('');

      let response;
      if (logoFile) {
        const body = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (key === 'permissions') {
            body.append(key, JSON.stringify(value));
          } else {
            body.append(key, value);
          }
        });
        body.append('company_logo', logoFile);
        response = await fetch(site.api.userCompany, {
          method: 'POST',
          body,
        });
      } else {
        response = await fetch(site.api.userCompany, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          data?.message || data?.error || data?.errors?.[0] || `Signup failed (${response.status})`;
        throw new Error(typeof message === 'string' ? message : 'Unable to create account.');
      }

      setStatus('completed');
      window.setTimeout(() => {
        closeSignup();
        window.location.assign(site.urls.login);
      }, 900);
    } catch (err) {
      setStatus('failed');
      setError(err?.message || 'Unable to create account. Please try again.');
    }
  };

  return (
    <div
      className="oh-signup"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && status !== 'pending' && closeSignup()}
    >
      <div className="oh-signup__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="oh-signup__header">
          <div>
            <p className="oh-eyebrow">Get started</p>
            <h2 id={titleId}>Create your company</h2>
          </div>
          <button
            type="button"
            className="oh-signup__close"
            aria-label="Close"
            onClick={closeSignup}
            disabled={status === 'pending'}
          >
            <X size={18} />
          </button>
        </header>

        <nav className="oh-signup__steps" aria-label="Signup progress">
          {STEPS.map((item, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <div
                key={item.id}
                className={`oh-signup__step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
              >
                <span className="oh-signup__step-index" aria-hidden="true">
                  {done ? <Check size={14} strokeWidth={2.5} /> : index + 1}
                </span>
                <span className="oh-signup__step-label">{item.label}</span>
              </div>
            );
          })}
        </nav>

        <form className="oh-signup__form" onSubmit={handleSubmit}>
          <div className="oh-signup__body">
            <div className="oh-signup__intro">
              <h3>{current.title}</h3>
              <p>{current.description}</p>
            </div>

            {step === 0 ? (
              <div className="oh-signup__grid">
                <div className="oh-signup__span">
                  <label htmlFor="oh-signup-name">Full name</label>
                  <input
                    id="oh-signup-name"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Jane Smith"
                    autoComplete="name"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="oh-signup-email">Work email</label>
                  <input
                    id="oh-signup-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="oh-signup-password">Password</label>
                  <input
                    id="oh-signup-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setField('password', e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <>
                <div className="oh-signup__grid">
                  <div>
                    <label htmlFor="oh-signup-company">Company name</label>
                    <input
                      id="oh-signup-company"
                      value={form.company_name}
                      onChange={(e) => setField('company_name', e.target.value)}
                      placeholder="Acme Retail"
                      autoComplete="organization"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="oh-signup-company-email">Company email</label>
                    <input
                      id="oh-signup-company-email"
                      type="email"
                      value={form.company_email}
                      onChange={(e) => setField('company_email', e.target.value)}
                      placeholder="hello@company.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="oh-signup__span">
                    <label htmlFor="oh-signup-address">Business address</label>
                    <input
                      id="oh-signup-address"
                      value={form.address}
                      onChange={(e) => setField('address', e.target.value)}
                      placeholder="Street, city, country"
                      autoComplete="street-address"
                      required
                    />
                  </div>
                </div>

                <div className="oh-signup__logo">
                  <div className="oh-signup__logo-copy">
                    <label htmlFor="oh-signup-logo">Company logo</label>
                    <p className="oh-signup__hint">Optional. Square PNG or JPG works best.</p>
                  </div>
                  <div className="oh-signup__logo-row">
                    <div className="oh-signup__logo-preview" aria-hidden="true">
                      {logoPreview ? (
                        <img src={logoPreview} alt="" />
                      ) : (
                        <ImagePlus size={22} strokeWidth={1.75} />
                      )}
                    </div>
                    <div className="oh-signup__logo-actions">
                      <input
                        ref={logoInputRef}
                        id="oh-signup-logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {logoPreview ? 'Change logo' : 'Upload logo'}
                      </Button>
                      {logoPreview ? (
                        <Button type="button" variant="ghost" size="sm" onClick={clearLogo}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <GoogleAddressField
                  googleAddress={form.google_address}
                  latitude={form.address_latitude}
                  longitude={form.address_longitude}
                  disabled={status === 'pending'}
                  onChange={({ google_address, address_latitude, address_longitude }) => {
                    setForm((prev) => ({
                      ...prev,
                      google_address,
                      address_latitude,
                      address_longitude,
                    }));
                  }}
                />
              </>
            ) : null}

            {error ? <p className="oh-signup__error">{error}</p> : null}
            {status === 'completed' ? (
              <p className="oh-signup__success">Account created. Redirecting to login…</p>
            ) : null}
          </div>

          <div className="oh-signup__footer">
            {step > 0 ? (
              <Button type="button" variant="secondary" onClick={goBack} disabled={status === 'pending'}>
                <ArrowLeft size={16} />
                Back
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={closeSignup} disabled={status === 'pending'}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={status === 'pending' || status === 'completed'}>
              {status === 'pending' ? (
                'Creating…'
              ) : isLast ? (
                'Create account'
              ) : (
                <>
                  Continue
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
