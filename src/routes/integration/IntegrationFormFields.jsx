import { STORE_TYPE_OPTIONS } from './integrationForm.js';

export default function IntegrationFormFields({
  form,
  errors,
  onChange,
  disabled = false,
  isEdit = false,
}) {
  return (
    <>
      <div className="integration-form-section">
        <div className="integration-form-section-title">
          <i className="fas fa-store text-primary" aria-hidden="true" />
          Store details
        </div>
        <p className="integration-form-section-hint">
          Platform, display name, and store URL for this connection.
        </p>

        <div className="row g-3">
          <div className="col-md-6">
            <label className="integration-form-label d-block" htmlFor="store_type">
              Store type <span className="req">*</span>
            </label>
            <select
              className={`form-select integration-form-control ${errors.store_type ? 'is-invalid' : ''}`}
              id="store_type"
              name="store_type"
              value={form.store_type}
              onChange={onChange}
              disabled={disabled}
            >
              {STORE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.store_type ? <div className="invalid-feedback">{errors.store_type}</div> : null}
          </div>
          <div className="col-md-6">
            <label className="integration-form-label d-block" htmlFor="name">
              Name <span className="req">*</span>
            </label>
            <input
              type="text"
              className={`form-control integration-form-control ${errors.name ? 'is-invalid' : ''}`}
              id="name"
              name="name"
              value={form.name}
              onChange={onChange}
              disabled={disabled}
            />
            {errors.name ? <div className="invalid-feedback">{errors.name}</div> : null}
          </div>
          <div className="col-12">
            <label className="integration-form-label d-block" htmlFor="url">
              Store URL <span className="req">*</span>
            </label>
            <input
              type="url"
              className={`form-control integration-form-control ${errors.url ? 'is-invalid' : ''}`}
              id="url"
              name="url"
              placeholder="https://your-store.example.com"
              value={form.url}
              onChange={onChange}
              disabled={disabled}
            />
            {errors.url ? <div className="invalid-feedback">{errors.url}</div> : null}
          </div>
          <div className="col-12">
            <label className="integration-form-label d-block" htmlFor="description">
              Description <span className="req">*</span>
            </label>
            <textarea
              className={`form-control integration-form-control ${errors.description ? 'is-invalid' : ''}`}
              id="description"
              name="description"
              rows={3}
              value={form.description}
              onChange={onChange}
              disabled={disabled}
            />
            {errors.description ? (
              <div className="invalid-feedback">{errors.description}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="integration-form-section">
        <div className="integration-form-section-title">
          <i className="fas fa-location-dot text-primary" aria-hidden="true" />
          Location
        </div>
        <p className="integration-form-section-hint">Business address associated with this store.</p>

        <div className="row g-3">
          <div className="col-12">
            <label className="integration-form-label d-block" htmlFor="address">
              Address <span className="req">*</span>
            </label>
            <input
              type="text"
              className={`form-control integration-form-control ${errors.address ? 'is-invalid' : ''}`}
              id="address"
              name="address"
              value={form.address}
              onChange={onChange}
              disabled={disabled}
            />
            {errors.address ? <div className="invalid-feedback">{errors.address}</div> : null}
          </div>
          <div className="col-md-6">
            <label className="integration-form-label d-block" htmlFor="city">
              City <span className="req">*</span>
            </label>
            <input
              type="text"
              className={`form-control integration-form-control ${errors.city ? 'is-invalid' : ''}`}
              id="city"
              name="city"
              value={form.city}
              onChange={onChange}
              disabled={disabled}
            />
            {errors.city ? <div className="invalid-feedback">{errors.city}</div> : null}
          </div>
          <div className="col-md-6">
            <label className="integration-form-label d-block" htmlFor="state">
              State <span className="req">*</span>
            </label>
            <input
              type="text"
              className={`form-control integration-form-control ${errors.state ? 'is-invalid' : ''}`}
              id="state"
              name="state"
              value={form.state}
              onChange={onChange}
              disabled={disabled}
            />
            {errors.state ? <div className="invalid-feedback">{errors.state}</div> : null}
          </div>
        </div>
      </div>

      <div className="integration-form-section">
        <div className="integration-form-section-title">
          <i className="fas fa-address-book text-primary" aria-hidden="true" />
          Contact
        </div>
        <p className="integration-form-section-hint">Optional contact details for this integration.</p>

        <div className="row g-3">
          <div className="col-md-6">
            <label className="integration-form-label d-block" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              className={`form-control integration-form-control ${errors.email ? 'is-invalid' : ''}`}
              id="email"
              name="email"
              value={form.email}
              onChange={onChange}
              disabled={disabled}
            />
            {errors.email ? <div className="invalid-feedback">{errors.email}</div> : null}
          </div>
          <div className="col-md-6">
            <label className="integration-form-label d-block" htmlFor="phone">
              Phone
            </label>
            <input
              type="text"
              className="form-control integration-form-control"
              id="phone"
              name="phone"
              value={form.phone}
              onChange={onChange}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div className="integration-form-section">
        <div className="integration-form-section-title">
          <i className="fas fa-key text-primary" aria-hidden="true" />
          API credentials
        </div>
        <p className="integration-form-section-hint">
          Keys and tokens used to authenticate with the external store.
        </p>

        <div className="row g-3">
          <div className="col-md-6">
            <label className="integration-form-label d-block" htmlFor="integration_key">
              API key <span className="req">*</span>
            </label>
            <input
              type="text"
              className={`form-control integration-form-control ${errors.integrationKey ? 'is-invalid' : ''}`}
              id="integration_key"
              name="integrationKey"
              value={form.integrationKey}
              onChange={onChange}
              disabled={disabled}
              autoComplete="off"
            />
            {errors.integrationKey ? (
              <div className="invalid-feedback">{errors.integrationKey}</div>
            ) : null}
          </div>
          <div className="col-md-6">
            <label className="integration-form-label d-block" htmlFor="integration_secret">
              API secret {!isEdit ? <span className="req">*</span> : null}
            </label>
            <input
              type="password"
              className={`form-control integration-form-control ${errors.integrationSecret ? 'is-invalid' : ''}`}
              id="integration_secret"
              name="integrationSecret"
              value={form.integrationSecret}
              onChange={onChange}
              disabled={disabled}
              autoComplete="new-password"
              placeholder={isEdit ? 'Leave blank to keep current secret' : undefined}
            />
            {errors.integrationSecret ? (
              <div className="invalid-feedback">{errors.integrationSecret}</div>
            ) : null}
          </div>
          <div className="col-12">
            <label className="integration-form-label d-block" htmlFor="token">
              Access token
            </label>
            <input
              type="text"
              className="form-control integration-form-control"
              id="token"
              name="token"
              value={form.token}
              onChange={onChange}
              disabled={disabled}
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </>
  );
}
