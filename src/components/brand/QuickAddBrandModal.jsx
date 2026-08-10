import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import AppModal from '../AppModal.jsx';
import { createBrand } from '../../features/brands/brandsSlice.js';
import { fetchBrandsRequest } from '../../features/brands/brandsAPI.js';
import { toast } from '../../utils/toast.js';

const pickCreatedBrand = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.brand != null && typeof result.brand === 'object') {
    return result.brand;
  }
  if (result._id || result.id || result.brand_id) return result;
  return null;
};

/**
 * Lightweight modal to create a brand without leaving the product form.
 * Calls onCreated(brand) with the created record (or a best-effort stub).
 */
export default function QuickAddBrandModal({ open, onClose, onCreated }) {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parents, setParents] = useState([]);
  const [parentsStatus, setParentsStatus] = useState('idle');

  useEffect(() => {
    if (!open) return undefined;
    setName('');
    setParentId('');
    setDescription('');
    setErrors({});
    setFormError('');
    setSubmitting(false);

    let cancelled = false;
    setParentsStatus('loading');
    fetchBrandsRequest({
      page: 1,
      limit: 1000,
      sortBy: 'name',
      sortOrder: 'asc',
      populate: 'parent_id',
    })
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
      parents.map((brand) => ({
        id: String(brand._id || brand.id || ''),
        name: brand.name || brand.brand_name || 'Brand',
      })),
    [parents]
  );

  const handleNameChange = (e) => {
    setName(e.target.value);
    if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
    if (formError) setFormError('');
  };

  const handleDescriptionChange = (e) => {
    setDescription(e.target.value);
    if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
    if (formError) setFormError('');
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Name is required';
    if (!description.trim()) next.description = 'Description is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const brandData = {
        name: name.trim(),
        description: description.trim(),
      };
      if (parentId) brandData.parent_id = parentId;

      const result = await dispatch(createBrand(brandData)).unwrap();
      const created = pickCreatedBrand(result);
      const id = String(created?._id ?? created?.id ?? created?.brand_id ?? '').trim();
      const record = created || {
        _id: id,
        name: brandData.name,
        description: brandData.description,
      };

      toast.success('Brand created successfully.');
      onCreated?.(record);
      onClose?.();
    } catch (error) {
      const message =
        typeof error === 'string' ? error : error?.message || 'Failed to create brand';
      setFormError(message);
      toast.error(message);
      if (/description/i.test(message)) {
        setErrors((prev) => ({
          ...prev,
          description: prev.description || 'Description is required',
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Add new brand"
      subtitle="Create a brand and select it on this product."
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
            form="quick-add-brand-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create brand'}
          </button>
        </>
      }
    >
      <form id="quick-add-brand-form" onSubmit={handleSubmit}>
        {formError ? (
          <div className="alert alert-danger py-2 px-3 mb-3" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="mb-3">
          <label htmlFor="quick_brand_name" className="form-label">
            Brand name <span className="text-danger">*</span>
          </label>
          <input
            id="quick_brand_name"
            type="text"
            className={`form-control ${errors.name ? 'is-invalid' : ''}`}
            value={name}
            onChange={handleNameChange}
            placeholder="Enter brand name"
            autoFocus
            disabled={submitting}
          />
          {errors.name ? <div className="invalid-feedback">{errors.name}</div> : null}
        </div>

        <div className="mb-3">
          <label htmlFor="quick_brand_parent" className="form-label">
            Parent brand
          </label>
          <select
            id="quick_brand_parent"
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
            <small className="text-danger d-block mt-1">Could not load parent brands.</small>
          ) : (
            <small className="text-muted d-block mt-1">Optional.</small>
          )}
        </div>

        <div className="mb-0">
          <label htmlFor="quick_brand_description" className="form-label">
            Description <span className="text-danger">*</span>
          </label>
          <textarea
            id="quick_brand_description"
            className={`form-control ${errors.description ? 'is-invalid' : ''}`}
            rows={3}
            value={description}
            onChange={handleDescriptionChange}
            placeholder="Enter brand description"
            disabled={submitting}
          />
          {errors.description ? (
            <div className="invalid-feedback">{errors.description}</div>
          ) : null}
        </div>
      </form>
    </AppModal>
  );
}
