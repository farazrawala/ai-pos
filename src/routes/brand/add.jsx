import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { createBrand } from '../../features/brands/brandsSlice.js';
import { fetchBrandsRequest } from '../../features/brands/brandsAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const BrandAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { canCreate } = usePermissions('brands');
  const [form, setForm] = useState({
    parent_id: '',
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentBrands, setParentBrands] = useState([]);
  const [parentListStatus, setParentListStatus] = useState('idle');

  useEffect(() => {
    if (canCreate === false) navigate('/brands');
  }, [canCreate, navigate]);

  useEffect(() => {
    let cancelled = false;
    setParentListStatus('loading');
    fetchBrandsRequest({
      page: 1,
      limit: 1000,
      sortBy: 'name',
      sortOrder: 'asc',
      populate: 'parent_id',
    })
      .then((res) => {
        if (!cancelled) {
          setParentBrands(Array.isArray(res.data) ? res.data : []);
          setParentListStatus('succeeded');
        }
      })
      .catch((err) => {
        console.error('[Brand module] Failed to load parent brands for add form', err);
        if (!cancelled) {
          setParentBrands([]);
          setParentListStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const showToast = (elementId, bodyText) => {
    const toastElement = document.getElementById(elementId);
    if (!toastElement) return;
    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) timeElement.textContent = moment().format('h:mm A');
    if (bodyText) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = bodyText;
    }
    if (window.bootstrap?.Toast) {
      new window.bootstrap.Toast(toastElement, { autohide: true, delay: 5000 }).show();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const brandData = {
        name: form.name.trim(),
        description: form.description,
      };
      if (form.parent_id) brandData.parent_id = form.parent_id;

      await dispatch(createBrand(brandData)).unwrap();
      showToast('successToast', 'Brand created successfully!');
      setTimeout(() => navigate('/brands'), 1000);
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message || 'An error occurred while creating the brand.';
      showToast('dangerToast', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Add New Brand</h5>
                  <p className="text-sm mb-0">Create a new brand for your products</p>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/brands')}
                >
                  Back to List
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="parent_id" className="form-label">
                    Parent brand
                  </label>
                  <select
                    className="form-select"
                    id="parent_id"
                    name="parent_id"
                    value={form.parent_id}
                    onChange={handleChange}
                    disabled={parentListStatus === 'loading'}
                  >
                    <option value="">None (top-level)</option>
                    {parentBrands.map((brand) => (
                      <option key={brand._id} value={brand._id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  {parentListStatus === 'failed' && (
                    <small className="text-danger d-block mt-1">
                      Could not load brands for this list.
                    </small>
                  )}
                  <small className="text-muted">
                    Optional. Choose a parent to create a sub-brand.
                  </small>
                </div>

                <div className="mb-3">
                  <label htmlFor="name" className="form-label">
                    Brand Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    id="name"
                    name="name"
                    placeholder="Enter brand name"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>

                <div className="mb-4">
                  <label htmlFor="description" className="form-label">
                    Description
                  </label>
                  <textarea
                    className="form-control"
                    id="description"
                    name="description"
                    rows="4"
                    placeholder="Enter brand description (optional)"
                    value={form.description}
                    onChange={handleChange}
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/brands')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Brand'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="position-fixed bottom-1 end-1 z-index-2">
        <div
          className="toast fade hide p-2 bg-white"
          role="alert"
          id="successToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <div className="toast-body">Brand created successfully!</div>
        </div>
        <div
          className="toast fade hide p-2 mt-2 bg-white"
          role="alert"
          id="dangerToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <span className="me-auto text-danger font-weight-bold">Error</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <div className="toast-body">An error occurred while creating the brand.</div>
        </div>
      </div>
    </div>
  );
};

export default BrandAdd;
