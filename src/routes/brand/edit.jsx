import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import {
  fetchBrandById,
  updateBrand,
  clearUpdateStatus,
  clearCurrentBrand,
} from '../../features/brands/brandsSlice.js';
import { fetchBrandsRequest } from '../../features/brands/brandsAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const parentIdFromBrand = (brand) => {
  if (!brand) return '';
  const raw = brand.parent_id ?? brand.parent;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && raw._id != null) return String(raw._id);
  return String(raw);
};

const BrandEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentBrand, fetchStatus, fetchError, updateStatus } = useSelector(
    (state) => state.brands
  );

  const [form, setForm] = useState({
    parent_id: '',
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [parentBrands, setParentBrands] = useState([]);
  const [parentListStatus, setParentListStatus] = useState('idle');

  const isSubmitting = updateStatus === 'loading';
  const isLoading = fetchStatus === 'loading';
  const { canEdit } = usePermissions('brands');

  useEffect(() => {
    if (canEdit === false) navigate('/brands');
  }, [canEdit, navigate]);

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
        console.error('[Brand module] Failed to load parent brands for edit form', err);
        if (!cancelled) {
          setParentBrands([]);
          setParentListStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (id) dispatch(fetchBrandById(id));
    return () => {
      dispatch(clearCurrentBrand());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (currentBrand && fetchStatus === 'succeeded') {
      setForm({
        parent_id: parentIdFromBrand(currentBrand),
        name: currentBrand.name || currentBrand.brand_name || '',
        description: currentBrand.description || '',
      });
    }
  }, [currentBrand, fetchStatus]);

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

    try {
      await dispatch(
        updateBrand({
          brandId: id,
          brandData: {
            name: form.name.trim(),
            description: form.description,
            parent_id: form.parent_id || null,
          },
        })
      ).unwrap();

      showToast('successToast', 'Brand updated successfully!');
      setTimeout(() => {
        dispatch(clearUpdateStatus());
        navigate('/brands');
      }, 1000);
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message || 'An error occurred while updating the brand.';
      showToast('dangerToast', message);
      setTimeout(() => dispatch(clearUpdateStatus()), 5500);
    }
  };

  if (isLoading) {
    return (
      <div className="container-fluid py-4 px-0">
        <div className="row">
          <div className="col-12" style={{ padding: '20px' }}>
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="card-body text-center p-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading brand data...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4 px-0">
        <div className="row">
          <div className="col-12" style={{ padding: '20px' }}>
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="card-body">
                <div className="alert alert-danger" role="alert">
                  <h5 className="alert-heading">Error Loading Brand</h5>
                  <p>{fetchError || 'Failed to load brand data.'}</p>
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => navigate('/brands')}
                  >
                    Back to List
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Edit Brand</h5>
                  <p className="text-sm mb-0">Update brand information</p>
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
                    disabled={isSubmitting || parentListStatus === 'loading'}
                  >
                    <option value="">None (top-level)</option>
                    {parentBrands
                      .filter((brand) => String(brand._id) !== String(id))
                      .map((brand) => (
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
                    {isSubmitting ? 'Updating...' : 'Update Brand'}
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
          <div className="toast-body">Brand updated successfully!</div>
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
          <div className="toast-body">An error occurred while updating the brand.</div>
        </div>
      </div>
    </div>
  );
};

export default BrandEdit;
