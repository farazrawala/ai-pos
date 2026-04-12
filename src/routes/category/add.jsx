import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { createCategory } from '../../features/categories/categoriesSlice.js';
import {
  fetchCategoriesRequest,
  fetchCategoryByIdRequest,
  isCategoryUploadFilePart,
} from '../../features/categories/categoriesAPI.js';
import { logCategoryUploadErrorToFile } from '../../utils/categoryUploadFileLog.js';
import { usePermissions } from '../../hooks/usePermissions.js';

/** Normalize create API payloads like `{ data: { ... } }` or plain category object. */
const pickCreatedCategory = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.category != null && typeof result.category === 'object') {
    return result.category;
  }
  if (result._id || result.id || result.category_id) {
    return result;
  }
  return null;
};

const pickImageFromCategory = (cat) => {
  if (!cat || typeof cat !== 'object') return '';
  const raw = cat.image ?? cat.category_image ?? cat.categoryImage ?? '';
  if (raw == null) return '';
  if (typeof raw === 'object' && raw.url != null) return String(raw.url);
  return String(raw);
};

const CategoryAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    parent_id: '',
    name: '',
    slug: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentCategories, setParentCategories] = useState([]);
  const [parentListStatus, setParentListStatus] = useState('idle');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const imageInputRef = useRef(null);

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
        console.error('[Category module] Failed to load parent categories for add form', err);
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
      setErrors((prev) => ({
        ...prev,
        image: 'Only image uploads are allowed (e.g. PNG, JPEG, WebP).',
      }));
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

  const clearImage = () => {
    setImageFile(null);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setErrors((prev) => ({ ...prev, image: '' }));
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

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

    setIsSubmitting(true);
    try {
      const categoryFields = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description,
      };
      if (form.parent_id) {
        categoryFields.parent_id = form.parent_id;
      }

      const hadImageUpload = isCategoryUploadFilePart(imageFile);
      const result = await dispatch(
        createCategory({
          categoryFields,
          image: hadImageUpload ? imageFile : undefined,
        })
      ).unwrap();

      const created = pickCreatedCategory(result);
      const categoryId = created?._id ?? created?.id ?? created?.category_id;
      let savedName = created ? String(created.name ?? created.category_name ?? '').trim() : '';
      let savedSlug = created ? String(created.slug ?? '').trim() : '';
      let savedImage = pickImageFromCategory(created);
      let imageVerifiedViaGet = false;

      if (hadImageUpload && created && categoryId && !String(savedImage).trim()) {
        try {
          const getRaw = await fetchCategoryByIdRequest(String(categoryId));
          const fromGet = pickCreatedCategory(getRaw);
          const imageAfterGet = pickImageFromCategory(fromGet);
          if (String(imageAfterGet).trim()) {
            savedImage = imageAfterGet;
            imageVerifiedViaGet = true;
            if (fromGet) {
              savedName =
                String(fromGet.name ?? fromGet.category_name ?? savedName).trim() || savedName;
              savedSlug = String(fromGet.slug ?? savedSlug).trim() || savedSlug;
            }
            console.info(
              '[Category module] Create response omitted image; GET-by-id returned image URL',
              {
                categoryId,
              }
            );
          }
        } catch (refetchErr) {
          console.warn(
            '[Category module] GET category by id after create failed (could not verify image)',
            {
              categoryId,
              message: refetchErr?.message || String(refetchErr),
            }
          );
          logCategoryUploadErrorToFile('addCategory.refetchAfterCreateMissingImage', {
            categoryId,
            message: refetchErr?.message || String(refetchErr),
            error: refetchErr,
          });
        }
      }

      const nameMatches = !created || savedName === categoryFields.name;
      const slugMatches = !created || savedSlug === categoryFields.slug;
      const imageStoredOrNotExpected = !hadImageUpload || Boolean(String(savedImage).trim());

      console.info('[Category module] Category create succeeded — verification', {
        topLevelKeys: result && typeof result === 'object' ? Object.keys(result) : [],
        categoryId,
        sent: {
          name: categoryFields.name,
          slug: categoryFields.slug,
          hadParent: Boolean(categoryFields.parent_id),
          hadImageUpload,
        },
        saved: {
          name: savedName || null,
          slug: savedSlug || null,
          imageFieldPresent: Boolean(String(savedImage).trim()),
        },
        checks: {
          entityInResponse: Boolean(created),
          nameMatches,
          slugMatches,
          imageStoredIfExpected: imageStoredOrNotExpected,
          ...(hadImageUpload ? { imageVerifiedViaGet } : {}),
        },
      });

      if (created && (!nameMatches || !slugMatches)) {
        console.warn('[Category module] Create response fields differ from what was sent', {
          sent: { name: categoryFields.name, slug: categoryFields.slug },
          saved: { name: savedName, slug: savedSlug },
        });
      }
      if (hadImageUpload && created && !String(savedImage).trim()) {
        console.warn(
          '[Category module] Image was sent but create and GET-by-id responses still have no image URL.',
          { categoryId }
        );
        logCategoryUploadErrorToFile('addCategory.noImageUrlAfterCreateAndGet', {
          categoryId,
        });
      }

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

      // Navigate back to category list after a short delay
      setTimeout(() => {
        // navigate('/categories');
      }, 1000);
    } catch (error) {
      const normalizedMessage =
        typeof error === 'string'
          ? error
          : error?.message ||
            (error && String(error)) ||
            'An error occurred while creating the category.';
      console.error('[Category module] Add category form submit failed', {
        message: normalizedMessage,
        raw: error,
        imageFileState: imageFile
          ? {
              acceptedAsUpload: isCategoryUploadFilePart(imageFile),
              name: imageFile.name,
              size: imageFile.size,
              type: imageFile.type,
              instanceofFile: typeof File !== 'undefined' && imageFile instanceof File,
              instanceofBlob: typeof Blob !== 'undefined' && imageFile instanceof Blob,
            }
          : { imageFile: null },
        formSummary: {
          name: form.name?.slice(0, 120),
          slug: form.slug,
          hasParent: Boolean(form.parent_id),
        },
      });
      if (isCategoryUploadFilePart(imageFile)) {
        logCategoryUploadErrorToFile('addCategory.formSubmit', {
          message: normalizedMessage,
          error: typeof error === 'string' ? undefined : error,
          imageFileState: imageFile
            ? {
                name: imageFile.name,
                size: imageFile.size,
                type: imageFile.type,
              }
            : null,
          formSummary: { slug: form.slug },
        });
      }

      // Extract error message
      const errorMessage = normalizedMessage;

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
    } finally {
      setIsSubmitting(false);
    }
  };
  // Get category permissions using the smart permission hook
  const { canEdit, canView, canDelete, canCreate } = usePermissions('category');

  // Redirect if user doesn't have create permission
  useEffect(() => {
    if (canCreate === false) {
      // navigate('/categories');
    }
  }, [canCreate, navigate]);
  const { user } = useSelector((state) => state.user);
  useEffect(() => {
    console.log('user', user);
    console.log('canCreate', canCreate);
    console.log('canEdit', canEdit);
    console.log('canDelete', canDelete);
    console.log('canView', canView);
  }, [canCreate]);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Add New Category</h5>
                  <p className="text-sm mb-0">Create a new category for your products</p>
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
                {/* Parent category */}
                <div className="mb-3">
                  <label htmlFor="parent_id" className="form-label">
                    Parent category
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
                    {parentCategories.map((cat) => (
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
                  <small className="text-muted">
                    Optional. Choose a parent to create a subcategory.
                  </small>
                </div>

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
                  />
                  <small className="text-muted">A brief description of this category.</small>
                </div>

                {/* Category image */}
                <div className="mb-4">
                  <label htmlFor="category_image" className="form-label">
                    Image
                  </label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    className={`form-control ${errors.image ? 'is-invalid' : ''}`}
                    id="category_image"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isSubmitting}
                  />
                  {errors.image && <div className="invalid-feedback d-block">{errors.image}</div>}
                  <small className="text-muted d-block">
                    Optional. Images only — PNG, JPEG, GIF, WebP, etc.
                  </small>
                  {imagePreview && (
                    <div className="mt-3 d-flex align-items-start gap-2">
                      <img
                        src={imagePreview}
                        alt="Selected category"
                        className="rounded border"
                        style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={clearImage}
                        disabled={isSubmitting}
                      >
                        Remove image
                      </button>
                    </div>
                  )}
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
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-2"></i>
                        Create Category
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
          <div className="toast-body">Category created successfully!</div>
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
          <div className="toast-body">An error occurred while creating the category.</div>
        </div>
      </div>
    </div>
  );
};

export default CategoryAdd;
