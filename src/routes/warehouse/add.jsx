import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createWarehouse } from '../../features/warehouse/warehouseSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const WarehouseAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { canCreate } = usePermissions('warehouse');
  const [form, setForm] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    warehouse_image: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (canCreate === false) navigate('/warehouse');
  }, [canCreate, navigate]);

  const validateForm = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await dispatch(createWarehouse(form)).unwrap();
      navigate('/warehouse');
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        submit: error?.message || error || 'Failed to create warehouse',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Add Warehouse</h5>
                  <p className="text-sm mb-0">Create a new warehouse.</p>
                </div>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate('/warehouse')}>
                  Back to List
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label">Code</label>
                  <input
                    className="form-control"
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">City</label>
                    <input
                      className="form-control"
                      value={form.city}
                      onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">State</label>
                    <input
                      className="form-control"
                      value={form.state}
                      onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Zip Code</label>
                    <input
                      className="form-control"
                      value={form.zip_code}
                      onChange={(e) => setForm((prev) => ({ ...prev, zip_code: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-control"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                  {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                </div>
                <div className="mb-4">
                  <label className="form-label">Warehouse Image (URL)</label>
                  <input
                    className="form-control"
                    value={form.warehouse_image}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, warehouse_image: e.target.value }))
                    }
                  />
                </div>
                {errors.submit && <div className="alert alert-danger py-2">{errors.submit}</div>}
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/warehouse')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Warehouse'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarehouseAdd;
