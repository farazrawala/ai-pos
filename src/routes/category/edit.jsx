import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import {
  fetchCategoryById,
  updateCategory,
  clearUpdateStatus,
  clearCurrentCategory,
} from '../../features/categories/categoriesSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const CategoryEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCategory, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.categories
  );

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const isSubmitting = updateStatus === 'loading';
  const isLoading = fetchStatus === 'loading';

  // Get category permissions
  const { canEdit } = usePermissions('category');

  // Redirect if user doesn't have edit permission
  useEffect(() => {
    if (canEdit === false) {
      navigate('/categories');
    }
  }, [canEdit, navigate]);

  // Fetch category data on mount
  useEffect(() => {
    if (id) {
      dispatch(fetchCategoryById(id));
    }
    // Cleanup: clear current category when component unmounts
    return () => {
      dispatch(clearCurrentCategory());
    };
  }, [dispatch, id]);

  // Populate form when category data is loaded
  useEffect(() => {
    if (currentCategory && fetchStatus === 'succeeded') {
      setForm({
        name: currentCategory.name || currentCategory.category_name || '',
        slug: currentCategory.slug || '',
        description: currentCategory.description || '',
      });
    }
  }, [currentCategory, fetchStatus]);

  // Auto-generate slug from name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-generate slug from name if slug is empty or was auto-generated
      if (name === 'name' && (!prev.slug || prev.slug === generateSlug(prev.name))) {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!form.slug.trim()) {
      newErrors.slug = 'Slug is required';
    } else if (!/^[a-z0-9-]+$/.test(form.slug)) {
      newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await dispatch(updateCategory({ categoryId: id, categoryData: form })).unwrap();

      // Show success toast
      const toastElement = document.getElementById('successToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }
      }

      // Clear update status after toast is shown
      setTimeout(() => {
        dispatch(clearUpdateStatus());
      }, 5500);

      // Navigate back to category list after a short delay
      setTimeout(() => {
        navigate('/categories');
      }, 1000);
    } catch (error) {
      // Extract error message
      const errorMessage =
        error?.message || error || 'An error occurred while updating the category.';

      // Show error toast
      const toastElement = document.getElementById('dangerToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        const toastBody = toastElement.querySelector('.toast-body');
        if (toastBody) {
          toastBody.textContent = errorMessage;
        }

        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }
      }

      // Clear update status after toast is shown
      setTimeout(() => {
        dispatch(clearUpdateStatus());
      }, 5500);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="row mt-4">
          <div className="col-12" style={{ padding: '20px' }}>
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="card-body text-center p-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading category data...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="row mt-4">
          <div className="col-12" style={{ padding: '20px' }}>
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="card-body">
                <div className="alert alert-danger" role="alert">
                  <h5 className="alert-heading">Error Loading Category</h5>
                  <p>{fetchError || 'Failed to load category data.'}</p>
                  <hr />
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => navigate('/categories')}
                  >
                    <i className="fas fa-arrow-left me-1"></i>
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
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Edit Category</h5>
                  <p className="text-sm mb-0">Update category information</p>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/categories')}
                >
                  <i className="fas fa-arrow-left me-1"></i>
                  Back to List
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                {/* Name Field */}
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">
                    Category Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    id="name"
                    name="name"
                    placeholder="Enter category name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                  <small className="text-muted">
                    The name will be used to identify this category.
                  </small>
                </div>

                {/* Slug Field */}
                <div className="mb-3">
                  <label htmlFor="slug" className="form-label">
                    Slug <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.slug ? 'is-invalid' : ''}`}
                    id="slug"
                    name="slug"
                    placeholder="category-slug"
                    value={form.slug}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                  />
                  {errors.slug && <div className="invalid-feedback">{errors.slug}</div>}
                  <small className="text-muted">
                    URL-friendly version of the name. Auto-generated from name, but you can edit it.
                  </small>
                </div>

                {/* Description Field */}
                <div className="mb-4">
                  <label htmlFor="description" className="form-label">
                    Description
                  </label>
                  <textarea
                    className="form-control"
                    id="description"
                    name="description"
                    rows="4"
                    placeholder="Enter category description (optional)"
                    value={form.description}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  <small className="text-muted">A brief description of this category.</small>
                </div>

                {/* Form Actions */}
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/categories')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Updating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-2"></i>
                        Update Category
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="position-fixed bottom-1 end-1 z-index-2">
        {/* Success Toast */}
        <div
          className="toast fade hide p-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="successToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Category updated successfully!</div>
        </div>

        {/* Danger Toast */}
        <div
          className="toast fade hide p-2 mt-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="dangerToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-notification-70 text-danger me-2"></i>
            <span className="me-auto text-gradient text-danger font-weight-bold">Error</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">An error occurred while updating the category.</div>
        </div>
      </div>
    </div>
  );
};

export default CategoryEdit;
