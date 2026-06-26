import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import {
  fetchCategoryById,
  updateCategory,
  clearUpdateStatus,
  clearCurrentCategory,
} from '../../features/categories/categoriesSlice.js';
import {
  fetchCategoriesRequest,
  isCategoryUploadFilePart,
} from '../../features/categories/categoriesAPI.js';
import {
  appendProjectDevLog,
  CATEGORY_IMAGE_UPLOAD_META,
} from '../../utils/projectDevLog.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import './category-form.css';

const parentIdFromCategory = (cat) => {
  if (!cat) return '';
  const raw = cat.parent_id ?? cat.parent;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && raw._id != null) return String(raw._id);
  return String(raw);
};

const categoryImageSrc = (cat) => {
  if (!cat) return '';
  const raw = cat.image ?? cat.category_image ?? cat.categoryImage ?? '';
  return resolveCategoryMediaUrl(raw);
};

const CategoryEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCategory, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.categories
  );

  const [form, setForm] = useState({
    parent_id: '',
    name: '',
    slug: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [parentCategories, setParentCategories] = useState([]);
  const [parentListStatus, setParentListStatus] = useState('idle');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const imageInputRef = useRef(null);
  const isSubmitting = updateStatus === 'loading';
  const isLoading = fetchStatus === 'loading';

  useEffect(() => {
    let cancelled = false;
    setParentListStatus('loading');
    fetchCategoriesRequest({
      page: 1,
      limit: 1000,
      sortBy: 'name',
      sortOrder: 'asc',
    })
      .then((res) => {
        if (!cancelled) {
          setParentCategories(Array.isArray(res.data) ? res.data : []);
          setParentListStatus('succeeded');
        }
      })
      .catch((err) => {
        console.error('[Category module] Failed to load parent categories for edit form', err);
        if (!cancelled) {
          setParentCategories([]);
          setParentListStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'Only image uploads are allowed (e.g. PNG, JPEG, WebP).' }));
      e.target.value = '';
      return;
    }
    setErrors((prev) => ({ ...prev, image: '' }));
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearNewImage = () => {
    setImageFile(null);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setErrors((prev) => ({ ...prev, image: '' }));
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Get category permissions
  const { canEdit } = usePermissions('categories');

  // Redirect if user doesn't have edit permission
  useEffect(() => {
    if (canEdit === false) {
      navigate('/categories');
    }
  }, [canEdit, navigate]);

  useEffect(() => {
    if (fetchStatus === 'failed' && fetchError) {
      console.error('[Category module] Failed to load category for edit', { categoryId: id, fetchError });
    }
  }, [fetchStatus, fetchError, id]);

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
        parent_id: parentIdFromCategory(currentCategory),
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
      const categoryFields = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description,
        parent_id: form.parent_id || null,
      };
      await dispatch(
        updateCategory({
          categoryId: id,
          categoryFields,
          image: isCategoryUploadFilePart(imageFile) ? imageFile : undefined,
        })
      ).unwrap();

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
      console.error('[Category module] Failed to update category', { categoryId: id, error });
      if (isCategoryUploadFilePart(imageFile)) {
        appendProjectDevLog(
          'editCategory.formSubmit',
          {
            categoryId: id,
            message:
              typeof error === 'string'
                ? error
                : error?.message || (error && String(error)) || 'Update failed',
            error: typeof error === 'string' ? undefined : error,
            imageFileState: {
              name: imageFile.name,
              size: imageFile.size,
              type: imageFile.type,
            },
          },
          CATEGORY_IMAGE_UPLOAD_META
        );
      }

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
      <div className="cat-form-page">
        <div className="cat-form-card card">
          <div className="card-body text-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 mb-0 text-muted">Loading category data…</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (fetchStatus === 'failed') {
    return (
      <div className="cat-form-page">
        <div className="cat-form-card card">
          <div className="card-body p-4">
            <div className="alert alert-danger mb-0" role="alert">
              <h6 className="alert-heading">Error loading category</h6>
              <p className="mb-3">{fetchError || 'Failed to load category data.'}</p>
              <button
                className="btn btn-sm btn-outline-danger mb-0"
                onClick={() => navigate('/categories')}
              >
                <i className="fas fa-arrow-left me-1"></i>
                Back to list
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const existingImage = categoryImageSrc(currentCategory);
  const previewSrc = imagePreview || existingImage;

  return (
    <div className="cat-form-page">
      <form onSubmit={handleSubmit}>
        <div className="cat-form-card card">
          <div className="cat-form-header">
            <div>
              <span className="cat-form-eyebrow">
                <i className="fas fa-folder-tree" aria-hidden="true" />
                Categories
              </span>
              <h5 className="cat-form-title">Edit category</h5>
              <p className="cat-form-subtitle">
                Update the details for{' '}
                <strong>{form.name || currentCategory?.name || 'this category'}</strong>.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary mb-0"
              onClick={() => navigate('/categories')}
            >
              <i className="fas fa-arrow-left me-1"></i>
              Back to list
            </button>
          </div>

          <div className="cat-form-body">
            <div className="row g-3">
              {/* Details */}
              <div className="col-lg-7">
                <div className="cat-form-section">
                  <div className="cat-form-section-title">
                    <i className="fas fa-circle-info text-primary" aria-hidden="true" />
                    Details
                  </div>
                  <p className="cat-form-section-hint">Basic information about the category.</p>

                  <div className="mb-3">
                    <label htmlFor="parent_id" className="cat-form-label d-block">
                      Parent category
                    </label>
                    <select
                      className="form-select cat-form-control"
                      id="parent_id"
                      name="parent_id"
                      value={form.parent_id}
                      onChange={handleChange}
                      disabled={isSubmitting || parentListStatus === 'loading'}
                    >
                      <option value="">None (top-level)</option>
                      {parentCategories
                        .filter((cat) => String(cat._id) !== String(id))
                        .map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name}
                          </option>
                        ))}
                    </select>
                    {parentListStatus === 'failed' && (
                      <small className="text-danger d-block mt-1">
                        Could not load categories for this list.
                      </small>
                    )}
                    <small className="cat-form-help">
                      Optional. Choose a parent for a subcategory, or none for top-level.
                    </small>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="name" className="cat-form-label d-block">
                      Category name <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control cat-form-control ${errors.name ? 'is-invalid' : ''}`}
                      id="name"
                      name="name"
                      placeholder="Enter category name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    />
                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                    <small className="cat-form-help">
                      The name will be used to identify this category.
                    </small>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="slug" className="cat-form-label d-block">
                      Slug <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control cat-form-control ${errors.slug ? 'is-invalid' : ''}`}
                      id="slug"
                      name="slug"
                      placeholder="category-slug"
                      value={form.slug}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    />
                    {errors.slug && <div className="invalid-feedback">{errors.slug}</div>}
                    <small className="cat-form-help">
                      URL-friendly version of the name. Auto-generated, but you can edit it.
                    </small>
                  </div>

                  <div className="mb-0">
                    <label htmlFor="description" className="cat-form-label d-block">
                      Description
                    </label>
                    <textarea
                      className="form-control cat-form-control"
                      id="description"
                      name="description"
                      rows="4"
                      placeholder="Enter category description (optional)"
                      value={form.description}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                    <small className="cat-form-help">A brief description of this category.</small>
                  </div>
                </div>
              </div>

              {/* Image */}
              <div className="col-lg-5">
                <div className="cat-form-section">
                  <div className="cat-form-section-title">
                    <i className="fas fa-image text-primary" aria-hidden="true" />
                    Image
                  </div>
                  <p className="cat-form-section-hint">
                    Optional. PNG, JPEG, GIF or WebP. Replaces the current image.
                  </p>

                  <input
                    ref={imageInputRef}
                    type="file"
                    className="d-none"
                    id="category_image"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isSubmitting}
                  />

                  {previewSrc ? (
                    <>
                      <div className="cat-image-preview-wrap">
                        <span className="cat-image-badge">
                          {imagePreview ? 'New image' : 'Current'}
                        </span>
                        <img src={previewSrc} alt="Category" />
                      </div>
                      <div className="cat-image-preview-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-0"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={isSubmitting}
                        >
                          <i className="fas fa-arrows-rotate me-1" aria-hidden="true" />
                          Change
                        </button>
                        {imagePreview && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary mb-0"
                            onClick={clearNewImage}
                            disabled={isSubmitting}
                          >
                            Discard new
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div
                      className="cat-image-dropzone"
                      role="button"
                      tabIndex={0}
                      onClick={() => imageInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          imageInputRef.current?.click();
                        }
                      }}
                    >
                      <div className="cat-image-dropzone-icon">
                        <i className="fas fa-cloud-arrow-up" aria-hidden="true" />
                      </div>
                      <p className="cat-image-dropzone-text">Click to upload an image</p>
                      <p className="cat-image-dropzone-sub">PNG, JPEG, GIF, WebP</p>
                    </div>
                  )}
                  {errors.image && <div className="text-danger small mt-2">{errors.image}</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="cat-form-footer">
            <span className="cat-form-footer-note">
              <span className="req text-danger">*</span> Required fields
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary mb-0"
              onClick={() => navigate('/categories')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary mb-0" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Updating…
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>
                  Update category
                </>
              )}
            </button>
          </div>
        </div>
      </form>

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
