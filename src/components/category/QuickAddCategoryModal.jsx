import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import AppModal from '../AppModal.jsx';
import { createCategory } from '../../features/categories/categoriesSlice.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import { toast } from '../../utils/toast.js';

const generateSlug = (name) =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const pickCreatedCategory = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.category != null && typeof result.category === 'object') {
    return result.category;
  }
  if (result._id || result.id || result.category_id) return result;
  return null;
};

/**
 * Lightweight modal to create a category without leaving the product form.
 * Calls onCreated(category) with the created record (or a best-effort stub).
 */
export default function QuickAddCategoryModal({ open, onClose, onCreated }) {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parents, setParents] = useState([]);
  const [parentsStatus, setParentsStatus] = useState('idle');

  useEffect(() => {
    if (!open) return undefined;
    setName('');
    setSlug('');
    setParentId('');
    setErrors({});
    setFormError('');
    setSubmitting(false);

    let cancelled = false;
    setParentsStatus('loading');
    fetchCategoriesRequest({ page: 1, limit: 1000, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => {
        if (!cancelled) {
          setParents(Array.isArray(res.data) ? res.data : []);
          setParentsStatus('succeeded');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParents([]);
          setParentsStatus('failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const parentOptions = useMemo(
    () =>
      parents.map((cat) => ({
        id: String(cat._id || cat.id || ''),
        name: cat.name || cat.category_name || 'Category',
      })),
    [parents]
  );

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    setSlug((prev) => {
      const auto = generateSlug(name);
      if (!prev || prev === auto) return generateSlug(value);
      return prev;
    });
    if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
  };

  const handleSlugChange = (e) => {
    setSlug(e.target.value);
    if (errors.slug) setErrors((prev) => ({ ...prev, slug: '' }));
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Name is required';
    const slugValue = slug.trim() || generateSlug(name);
    if (!slugValue) next.slug = 'Slug is required';
    else if (!/^[a-z0-9-]+$/.test(slugValue)) {
      next.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const categoryFields = {
        name: name.trim(),
        slug: (slug.trim() || generateSlug(name)).trim(),
      };
      if (parentId) categoryFields.parent_id = parentId;

      const result = await dispatch(createCategory({ categoryFields })).unwrap();
      const created = pickCreatedCategory(result);
      const id = String(created?._id ?? created?.id ?? created?.category_id ?? '').trim();
      const record = created || {
        _id: id,
        name: categoryFields.name,
        slug: categoryFields.slug,
      };

      toast.success('Category created successfully.');
      onCreated?.(record);
      onClose?.();
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message || 'Failed to create category';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Add new category"
      subtitle="Create a category and select it on this product."
      size="sm"
      disableBackdropClose={submitting}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="quick-add-category-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create category'}
          </button>
        </>
      }
    >
      <form id="quick-add-category-form" onSubmit={handleSubmit}>
        {formError ? (
          <div className="alert alert-danger py-2 px-3 mb-3" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="mb-3">
          <label htmlFor="quick_category_name" className="form-label">
            Name <span className="text-danger">*</span>
          </label>
          <input
            id="quick_category_name"
            type="text"
            className={`form-control ${errors.name ? 'is-invalid' : ''}`}
            value={name}
            onChange={handleNameChange}
            placeholder="Category name"
            autoFocus
            disabled={submitting}
          />
          {errors.name ? <div className="invalid-feedback">{errors.name}</div> : null}
        </div>

        <div className="mb-3">
          <label htmlFor="quick_category_slug" className="form-label">
            Slug
          </label>
          <input
            id="quick_category_slug"
            type="text"
            className={`form-control ${errors.slug ? 'is-invalid' : ''}`}
            value={slug}
            onChange={handleSlugChange}
            placeholder="auto-generated-from-name"
            disabled={submitting}
          />
          {errors.slug ? <div className="invalid-feedback">{errors.slug}</div> : null}
        </div>

        <div className="mb-0">
          <label htmlFor="quick_category_parent" className="form-label">
            Parent category
          </label>
          <select
            id="quick_category_parent"
            className="form-select"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            disabled={submitting || parentsStatus === 'loading'}
          >
            <option value="">None (top-level)</option>
            {parentOptions.map((opt) =>
              opt.id ? (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ) : null
            )}
          </select>
          {parentsStatus === 'failed' ? (
            <small className="text-danger d-block mt-1">Could not load parent categories.</small>
          ) : (
            <small className="text-muted d-block mt-1">Optional.</small>
          )}
        </div>
      </form>
    </AppModal>
  );
}
