import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchWarehouseById,
  updateWarehouse,
  clearCurrentWarehouse,
  clearUpdateStatus,
} from '../../features/warehouse/warehouseSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const WarehouseEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentWarehouse, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.warehouse
  );
  const { canEdit } = usePermissions('warehouse');
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
  const isSubmitting = updateStatus === 'loading';

  useEffect(() => {
    if (canEdit === false) navigate('/warehouse');
  }, [canEdit, navigate]);

  useEffect(() => {
    if (id) dispatch(fetchWarehouseById(id));
    return () => {
      dispatch(clearCurrentWarehouse());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!currentWarehouse) return;
    setForm({
      name: currentWarehouse.name || '',
      code: currentWarehouse.code || currentWarehouse.warehouse_code || '',
      city: currentWarehouse.city || '',
      state: currentWarehouse.state || '',
      zip_code: currentWarehouse.zip_code || '',
      phone: currentWarehouse.phone || '',
      email: currentWarehouse.email || '',
      warehouse_image: currentWarehouse.warehouse_image || '',
    });
  }, [currentWarehouse]);

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
    try {
      await dispatch(updateWarehouse({ warehouseId: id, warehouseData: form })).unwrap();
      navigate('/warehouse');
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        submit: error?.message || error || 'Failed to update warehouse',
      }));
    }
  };

  if (fetchStatus === 'loading') return <div className="container-fluid py-4">Loading warehouse...</div>;
  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger">{fetchError || 'Failed to load warehouse.'}</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Edit Warehouse</h5>
                  <p className="text-sm mb-0">Update warehouse information.</p>
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
                    disabled={isSubmitting}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label">Code</label>
                  <input
                    className="form-control"
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">City</label>
                    <input
                      className="form-control"
                      value={form.city}
                      onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">State</label>
                    <input
                      className="form-control"
                      value={form.state}
                      onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-control"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  />
                </div>
                {(errors.submit || updateError) && (
                  <div className="alert alert-danger py-2">{errors.submit || updateError}</div>
                )}
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
                    {isSubmitting ? 'Updating...' : 'Update Warehouse'}
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

export default WarehouseEdit;
