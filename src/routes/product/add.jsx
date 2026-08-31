import { useState, useEffect, useRef, useMemo } from 'react';
import Multiselect from 'multiselect-react-dropdown';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createProduct } from '../../features/products/productsSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import { fetchBrandsRequest } from '../../features/brands/brandsAPI.js';
import { toast } from '../../utils/toast.js';
import QuickAddCategoryModal from '../../components/category/QuickAddCategoryModal.jsx';
import QuickAddBrandModal from '../../components/brand/QuickAddBrandModal.jsx';
import RichTextEditor from '../../components/common/RichTextEditor.jsx';
import ProductImageDropzone from '../../components/product/ProductImageDropzone.jsx';
import './product-form.css';
import {
  PRODUCT_ADDITIONAL_IMAGES_MAX,
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_HINT,
  validateProductImageFile,
} from '../../utils/productImageUpload.js';
import { PRODUCT_IMPORT_UNITS } from '../../features/products/productImportFields.js';

const isUnsetBigCommercePrice = (value) => {
  const s = String(value ?? '').trim();
  return s === '' || s === '0' || s === '0.00';
};

const ProductAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    product_code: '',
    description: '',
    price_before_tax: '',
    price: '',
    alert_qty: '',
    brand_id: '',
    unit: 'Piece',
    weight: '',
    length: '',
    width: '',
    height: '',
    dimension: '',
    tax_rate: '',
    barcode: '',
    sku: '',
    product_type: 'Single',
    categoryId: [],
    wholesale_price: '',
    show_on_bigcommerce: false,
    bigcommerce_price: '',
    bigcommerce_hold_qty: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [showQuickAddCategory, setShowQuickAddCategory] = useState(false);
  const [showQuickAddBrand, setShowQuickAddBrand] = useState(false);

  // Image states
  const [singleImage, setSingleImage] = useState(null);
  const [singleImagePreview, setSingleImagePreview] = useState(null);
  const [bulkImages, setBulkImages] = useState([]);
  const [bulkImagePreviews, setBulkImagePreviews] = useState([]);
  const singleImageInputRef = useRef(null);
  const bulkImagesInputRef = useRef(null);
  /** When false, BigCommerce price stays synced with retail price until the user edits it. */
  const bigcommercePriceManualRef = useRef(false);

  // Get product permissions
  const { canCreate } = usePermissions('products');
  const { canCreate: canCreateCategory } = usePermissions('categories');
  const { canCreate: canCreateBrand } = usePermissions('brands');

  // Redirect if user doesn't have create permission
  useEffect(() => {
    if (canCreate === false) {
      navigate('/products');
    }
  }, [canCreate, navigate]);

  // Fetch categories for dropdown
  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const result = await fetchCategoriesRequest({ page: 1, limit: 1000 });
        setCategories(result.data || []);
      } catch (error) {
        console.error('Failed to load categories:', error);
        toast.error('Failed to load categories. Please refresh and try again.');
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  // Fetch brands for dropdown
  useEffect(() => {
    const loadBrands = async () => {
      setLoadingBrands(true);
      try {
        const result = await fetchBrandsRequest({ page: 1, limit: 1000 });
        setBrands(result.data || []);
      } catch (error) {
        console.error('Failed to load brands:', error);
        toast.error('Failed to load brands. Please refresh and try again.');
      } finally {
        setLoadingBrands(false);
      }
    };
    loadBrands();
  }, []);

  const categoryOptions = useMemo(
    () =>
      categories.map((cat) => ({
        id: String(cat._id || cat.id),
        name: cat.name || cat.category_name || 'Category',
      })),
    [categories]
  );

  const selectedCategories = useMemo(
    () => categoryOptions.filter((opt) => form.categoryId.includes(opt.id)),
    [categoryOptions, form.categoryId]
  );

  const handleCategoryChange = (selectedList) => {
    setForm((prev) => ({
      ...prev,
      categoryId: selectedList.map((item) => item.id),
    }));
    if (errors.categoryId) {
      setErrors((prev) => ({ ...prev, categoryId: '' }));
    }
  };

  const handleQuickCategoryCreated = (created) => {
    const id = String(created?._id ?? created?.id ?? created?.category_id ?? '').trim();
    if (!id) return;
    setCategories((prev) => {
      const exists = prev.some((cat) => String(cat._id || cat.id) === id);
      if (exists) return prev;
      return [...prev, created];
    });
    setForm((prev) => {
      const current = Array.isArray(prev.categoryId) ? prev.categoryId.map(String) : [];
      if (current.includes(id)) return prev;
      return { ...prev, categoryId: [...current, id] };
    });
    if (errors.categoryId) {
      setErrors((prev) => ({ ...prev, categoryId: '' }));
    }
  };

  const handleQuickBrandCreated = (created) => {
    const id = String(created?._id ?? created?.id ?? created?.brand_id ?? '').trim();
    if (!id) return;
    setBrands((prev) => {
      const exists = prev.some((brand) => String(brand._id || brand.id) === id);
      if (exists) return prev;
      return [...prev, created];
    });
    setForm((prev) => ({ ...prev, brand_id: id }));
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

  const calcRetailFromRate = (before, rate) => {
    const beforeNum = parseFloat(before);
    if (before === '' || before == null || Number.isNaN(beforeNum)) return null;
    const rateNum = parseFloat(rate);
    const effectiveRate = rate === '' || rate == null || Number.isNaN(rateNum) ? 0 : rateNum;
    return String(Math.round(beforeNum * (1 + effectiveRate / 100) * 100) / 100);
  };

  const getSavePriceBeforeTax = () => {
    if (form.price_before_tax === '' || form.price_before_tax == null) return 0;
    const n = parseFloat(form.price_before_tax);
    return Number.isNaN(n) ? 0 : n;
  };

  const getSaveTaxRate = () => {
    if (form.tax_rate === '' || form.tax_rate == null) return undefined;
    const n = parseFloat(form.tax_rate);
    return Number.isNaN(n) ? undefined : n;
  };

  const buildPricingSaveFields = () => {
    const fields = { price_before_tax: getSavePriceBeforeTax() };
    const rate = getSaveTaxRate();
    if (rate !== undefined) {
      fields.tax_rate = rate;
    }
    return fields;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;

    if (name === 'bigcommerce_price') {
      bigcommercePriceManualRef.current = true;
    }

    setForm((prev) => {
      const updated = { ...prev };

      updated[name] = nextValue;

      if (name === 'price_before_tax' || name === 'tax_rate') {
        const retail = calcRetailFromRate(
          name === 'price_before_tax' ? nextValue : updated.price_before_tax,
          name === 'tax_rate' ? nextValue : updated.tax_rate
        );
        if (retail != null) {
          updated.price = retail;
          if (!bigcommercePriceManualRef.current) {
            updated.bigcommerce_price = retail;
          }
        }
      }

      if (name === 'price' && !bigcommercePriceManualRef.current) {
        updated.bigcommerce_price = nextValue;
      }

      if (name === 'show_on_bigcommerce' && nextValue === true) {
        if (
          !bigcommercePriceManualRef.current ||
          isUnsetBigCommercePrice(updated.bigcommerce_price)
        ) {
          updated.bigcommerce_price = String(updated.price ?? '');
          if (isUnsetBigCommercePrice(prev.bigcommerce_price)) {
            bigcommercePriceManualRef.current = false;
          }
        }
      }

      // Slug is read-only — always regenerate from the product name.
      if (name === 'name') {
        updated.slug = generateSlug(nextValue);
      }

      return updated;
    });
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Handle single image upload (browse or drag-and-drop)
  const handleSingleImageFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    const validationError = validateProductImageFile(file);
    if (validationError) {
      setErrors((prev) => ({
        ...prev,
        singleImage: validationError,
      }));
      if (singleImageInputRef.current) singleImageInputRef.current.value = '';
      return;
    }
    setSingleImage(file);
    setErrors((prev) => ({ ...prev, singleImage: '' }));

    const reader = new FileReader();
    reader.onloadend = () => {
      setSingleImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle bulk images upload (browse or drag-and-drop)
  const handleBulkImageFiles = (files) => {
    const list = Array.from(files || []);
    if (list.length > PRODUCT_ADDITIONAL_IMAGES_MAX) {
      setErrors((prev) => ({
        ...prev,
        bulkImages: `Maximum ${PRODUCT_ADDITIONAL_IMAGES_MAX} images allowed`,
      }));
      return;
    }

    const validFiles = [];
    const invalidFiles = [];

    list.forEach((file) => {
      const validationError = validateProductImageFile(file);
      if (validationError) {
        invalidFiles.push(`${file.name}: ${validationError}`);
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      setErrors((prev) => ({
        ...prev,
        bulkImages: invalidFiles.join(', '),
      }));
    } else {
      setErrors((prev) => ({ ...prev, bulkImages: '' }));
    }

    setBulkImages(validFiles);

    const previews = [];
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result);
        if (previews.length === validFiles.length) {
          setBulkImagePreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove single image
  const removeSingleImage = () => {
    setSingleImage(null);
    setSingleImagePreview(null);
    if (singleImageInputRef.current) {
      singleImageInputRef.current.value = '';
    }
  };

  // Remove bulk image
  const removeBulkImage = (index) => {
    const newImages = bulkImages.filter((_, i) => i !== index);
    const newPreviews = bulkImagePreviews.filter((_, i) => i !== index);
    setBulkImages(newImages);
    setBulkImagePreviews(newPreviews);
    if (bulkImagesInputRef.current) {
      bulkImagesInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (form.slug.trim() && !/^[a-z0-9-]+$/.test(form.slug)) {
      newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }

    if (!form.price || parseFloat(form.price) <= 0) {
      newErrors.price = 'Valid retail price is required';
    }

    if (form.alert_qty !== '' && (isNaN(form.alert_qty) || parseInt(form.alert_qty) < 0)) {
      newErrors.alert_qty = 'Alert quantity must be a valid number';
    }

    if (!form.unit) {
      newErrors.unit = 'Unit is required';
    }

    if (!form.product_type) {
      newErrors.product_type = 'Product type is required';
    }

    setErrors(newErrors);
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      const fieldLabels = {
        name: 'Product Name',
        slug: 'Slug',
        price: 'Retail price',
        alert_qty: 'Alert Quantity',
        unit: 'Unit',
        product_type: 'Product Type',
      };
      const invalidFields = Object.keys(validationErrors).map((key) => fieldLabels[key] || key);
      toast.error(
        invalidFields.length > 0
          ? `Please fill/fix: ${invalidFields.join(', ')}.`
          : 'Please fix the highlighted fields and try again.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare product data
      const productData = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
        ...buildPricingSaveFields(),
        show_on_bigcommerce: Boolean(form.show_on_bigcommerce),
        bigcommerce_price: String(form.bigcommerce_price ?? '').trim(),
        bigcommerce_hold_qty:
          form.bigcommerce_hold_qty !== '' && form.bigcommerce_hold_qty != null
            ? Number(form.bigcommerce_hold_qty)
            : 0,
        categoryId: Array.isArray(form.categoryId) ? form.categoryId : [form.categoryId],
        sku: form.sku.trim(),
        product_code: form.product_code.trim(),
        alert_qty: form.alert_qty ? parseInt(form.alert_qty) : 0,
        brand_id: form.brand_id || undefined,
        unit: form.unit,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        length: form.length ? parseFloat(form.length) : undefined,
        width: form.width ? parseFloat(form.width) : undefined,
        height: form.height ? parseFloat(form.height) : undefined,
        dimension: form.dimension.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        product_type: form.product_type,
        wholesale_price: form.wholesale_price ? parseFloat(form.wholesale_price) : undefined,
      };

      // Only include slug if it has a value
      if (form.slug.trim()) {
        productData.slug = form.slug.trim();
      }

      // Prepare images array (single image + bulk images)
      const images = [];
      if (singleImage) {
        images.push(singleImage);
      }
      if (bulkImages.length > 0) {
        images.push(...bulkImages);
      }

      await dispatch(createProduct({ productData, images })).unwrap();

      toast.success('Product created successfully!', { delay: 5000 });

      setTimeout(() => {
        navigate('/products');
      }, 1000);
    } catch (error) {
      const errorMessage =
        error?.message || error || 'An error occurred while creating the product.';
      toast.error(errorMessage, { delay: 7000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Add New Product</h5>
                  <p className="text-sm mb-0">Create a new product with images</p>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/products')}
                >
                  <i className="fas fa-arrow-left me-1"></i>
                  Back to List
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit} noValidate>
                {/* Name Field */}
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">
                    Product Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    style={errors.name ? { borderColor: '#dc3545' } : undefined}
                    id="name"
                    name="name"
                    placeholder="Enter product name"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                  {errors.name && <div className="text-danger text-sm mt-1">{errors.name}</div>}
                </div>

                {/* Slug Field */}
                <div className="mb-3">
                  <label htmlFor="slug" className="form-label">
                    Slug
                  </label>
                  <input
                    type="text"
                    className={`form-control bg-light ${errors.slug ? 'is-invalid' : ''}`}
                    style={errors.slug ? { borderColor: '#dc3545' } : undefined}
                    id="slug"
                    name="slug"
                    placeholder="product-slug"
                    value={form.slug}
                    readOnly
                  />
                  {errors.slug && <div className="text-danger text-sm mt-1">{errors.slug}</div>}
                  <small className="text-muted">
                    URL-friendly version of the name. Auto-generated from name.
                  </small>
                </div>

                {/* Category Field - Multiselect */}
                <div className="mb-3">
                  <div className="product-form-label-row">
                    <label htmlFor="categoryId" className="form-label">
                      Categories
                    </label>
                    {canCreateCategory ? (
                      <button
                        type="button"
                        className="product-form-quick-add"
                        onClick={() => setShowQuickAddCategory(true)}
                        disabled={isSubmitting}
                      >
                        + Add new
                      </button>
                    ) : null}
                  </div>
                  <div className={errors.categoryId ? 'is-invalid' : ''}>
                    <Multiselect
                      id="categoryId"
                      options={categoryOptions}
                      selectedValues={selectedCategories}
                      onSelect={handleCategoryChange}
                      onRemove={handleCategoryChange}
                      displayValue="name"
                      placeholder={loadingCategories ? 'Loading categories…' : 'Select categories'}
                      showCheckbox
                      emptyRecordMsg="No categories found"
                      disable={loadingCategories || isSubmitting}
                      className={errors.categoryId ? 'border border-danger rounded' : ''}
                    />
                  </div>
                  {errors.categoryId && (
                    <div className="text-danger text-sm mt-1">{errors.categoryId}</div>
                  )}
                </div>

                {/* Product Type Field */}
                <div className="mb-3">
                  <label htmlFor="product_type" className="form-label">
                    Product Type <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.product_type ? 'is-invalid' : ''}`}
                    style={errors.product_type ? { borderColor: '#dc3545' } : undefined}
                    id="product_type"
                    name="product_type"
                    value={form.product_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="Single">Single</option>
                    <option value="Variable">Variable</option>
                  </select>
                  {errors.product_type && (
                    <div className="text-danger text-sm mt-1">{errors.product_type}</div>
                  )}
                  {/* Manage Variations Button - Only show when Product Type is Variable */}
                  {form.product_type === 'Variable' && (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        disabled
                        title="Variations can be managed after the product is created"
                      >
                        <i className="fas fa-cog me-1"></i>
                        Manage Variations
                      </button>
                      <small className="text-muted d-block mt-1">
                        Save the product first to manage variations
                      </small>
                    </div>
                  )}
                </div>

                {/* Brand Field */}
                <div className="mb-3">
                  <div className="product-form-label-row">
                    <label htmlFor="brand_id" className="form-label">
                      Brand
                    </label>
                    {canCreateBrand ? (
                      <button
                        type="button"
                        className="product-form-quick-add"
                        onClick={() => setShowQuickAddBrand(true)}
                        disabled={isSubmitting}
                      >
                        + Add new
                      </button>
                    ) : null}
                  </div>
                  <select
                    className="form-select"
                    id="brand_id"
                    name="brand_id"
                    value={form.brand_id}
                    onChange={handleChange}
                    disabled={loadingBrands}
                  >
                    <option value="">Select a brand (optional)</option>
                    {brands.map((brand) => (
                      <option key={brand._id || brand.id} value={brand._id || brand.id}>
                        {brand.name || brand.brand_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price before tax, Tax rate, Retail, Wholesale, Alert Qty */}
                <div className="row">
                  <div className="col-md col-6 mb-3">
                    <label htmlFor="price_before_tax" className="form-label">
                      Price before tax
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`form-control ${errors.price_before_tax ? 'is-invalid' : ''}`}
                      id="price_before_tax"
                      name="price_before_tax"
                      placeholder="0.00"
                      value={form.price_before_tax}
                      onChange={handleChange}
                    />
                    {errors.price_before_tax && (
                      <div className="invalid-feedback">{errors.price_before_tax}</div>
                    )}
                  </div>
                  <div className="col-md col-6 mb-3">
                    <label htmlFor="tax_rate" className="form-label">
                      Tax rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className={`form-control ${errors.tax_rate ? 'is-invalid' : ''}`}
                      id="tax_rate"
                      name="tax_rate"
                      placeholder="0.00"
                      value={form.tax_rate}
                      onChange={handleChange}
                    />
                    {errors.tax_rate && <div className="invalid-feedback">{errors.tax_rate}</div>}
                  </div>
                  <div className="col-md col-6 mb-3">
                    <label htmlFor="price" className="form-label">
                      Retail price <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`form-control bg-light ${errors.price ? 'is-invalid' : ''}`}
                      style={errors.price ? { borderColor: '#dc3545' } : undefined}
                      id="price"
                      name="price"
                      placeholder="0.00"
                      value={form.price}
                      readOnly
                      aria-readonly="true"
                    />
                    {errors.price && <div className="text-danger text-sm mt-1">{errors.price}</div>}
                  </div>
                  <div className="col-md col-6 mb-3">
                    <label htmlFor="wholesale_price" className="form-label">
                      Wholesale Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      id="wholesale_price"
                      name="wholesale_price"
                      placeholder="0.00"
                      value={form.wholesale_price}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md col-6 mb-3">
                    <label htmlFor="alert_qty" className="form-label">
                      Alert Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      id="alert_qty"
                      name="alert_qty"
                      placeholder="0"
                      value={form.alert_qty}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* BigCommerce */}
                <div className="product-form-section mb-4">
                  <div className="product-form-section-title">
                    <i className="fas fa-store text-primary" aria-hidden="true" />
                    BigCommerce
                  </div>
                  <p className="product-form-section-hint">
                    Control listing and pricing for BigCommerce.
                  </p>
                  <div className="form-check form-switch mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="show_on_bigcommerce"
                      name="show_on_bigcommerce"
                      checked={Boolean(form.show_on_bigcommerce)}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                    <label className="form-check-label" htmlFor="show_on_bigcommerce">
                      Show on BigCommerce?
                    </label>
                  </div>
                  {form.show_on_bigcommerce ? (
                    <div className="row">
                      <div className="col-md-6 mb-3 mb-md-0">
                        <label htmlFor="bigcommerce_price" className="form-label">
                          BigCommerce Price
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="bigcommerce_price"
                          name="bigcommerce_price"
                          placeholder={form.price || '0.00'}
                          value={form.bigcommerce_price}
                          onChange={handleChange}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="bigcommerce_hold_qty" className="form-label">
                          BigCommerce Hold Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="form-control"
                          id="bigcommerce_hold_qty"
                          name="bigcommerce_hold_qty"
                          placeholder="0"
                          value={form.bigcommerce_hold_qty}
                          onChange={handleChange}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Product Code, SKU, and Barcode Row */}
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label htmlFor="product_code" className="form-label">
                      Product Code
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="product_code"
                      name="product_code"
                      placeholder="Product code (optional)"
                      value={form.product_code}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label htmlFor="sku" className="form-label">
                      SKU
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="sku"
                      name="sku"
                      placeholder="Product SKU (optional)"
                      value={form.sku}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label htmlFor="barcode" className="form-label">
                      Barcode
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="barcode"
                      name="barcode"
                      placeholder="Product barcode (optional)"
                      value={form.barcode}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Unit Field */}
                <div className="mb-3">
                  <label htmlFor="unit" className="form-label">
                    Unit <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.unit ? 'is-invalid' : ''}`}
                    style={errors.unit ? { borderColor: '#dc3545' } : undefined}
                    id="unit"
                    name="unit"
                    value={form.unit}
                    onChange={handleChange}
                    required
                  >
                    {PRODUCT_IMPORT_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  {errors.unit && <div className="text-danger text-sm mt-1">{errors.unit}</div>}
                </div>

                {/* Dimensions Row */}
                <div className="row">
                  <div className="col-md-3 mb-3">
                    <label htmlFor="weight" className="form-label">
                      Weight
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      id="weight"
                      name="weight"
                      placeholder="0.00"
                      value={form.weight}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label htmlFor="length" className="form-label">
                      Length
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      id="length"
                      name="length"
                      placeholder="0.00"
                      value={form.length}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label htmlFor="width" className="form-label">
                      Width
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      id="width"
                      name="width"
                      placeholder="0.00"
                      value={form.width}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label htmlFor="height" className="form-label">
                      Height
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      id="height"
                      name="height"
                      placeholder="0.00"
                      value={form.height}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Dimension */}
                <div className="mb-3">
                  <label htmlFor="dimension" className="form-label">
                    Dimension
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="dimension"
                    name="dimension"
                    placeholder="e.g., 10x20x30 (optional)"
                    value={form.dimension}
                    onChange={handleChange}
                  />
                </div>

                {/* Description Field */}
                <div className="mb-3">
                  <label htmlFor="description" className="form-label">
                    Description
                  </label>
                  <RichTextEditor
                    id="description"
                    value={form.description}
                    onChange={(html) => {
                      setForm((prev) => ({ ...prev, description: html }));
                      if (errors.description) {
                        setErrors((prev) => ({ ...prev, description: '' }));
                      }
                    }}
                    placeholder="Enter product description (optional)"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Single Image Upload */}
                <div className="mb-4">
                  <label className="form-label" htmlFor="product-main-image">
                    Main Product Image
                  </label>
                  <ProductImageDropzone
                    id="product-main-image"
                    inputRef={singleImageInputRef}
                    accept={PRODUCT_IMAGE_ACCEPT}
                    disabled={isSubmitting}
                    onFiles={handleSingleImageFiles}
                    hint={`Upload a single main product image (${PRODUCT_IMAGE_HINT})`}
                  />
                  {errors.singleImage && (
                    <div className="text-danger text-sm mt-1">{errors.singleImage}</div>
                  )}
                  {singleImagePreview && (
                    <div className="mt-3 position-relative" style={{ width: '200px' }}>
                      <img
                        src={singleImagePreview}
                        alt="Preview"
                        className="img-thumbnail"
                        style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        className="product-image-remove-btn"
                        onClick={removeSingleImage}
                        disabled={isSubmitting}
                        aria-label="Remove image"
                        title="Remove image"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Bulk Images Upload */}
                <div className="mb-4">
                  <label className="form-label" htmlFor="product-additional-images">
                    Additional Product Images
                  </label>
                  <ProductImageDropzone
                    id="product-additional-images"
                    inputRef={bulkImagesInputRef}
                    accept={PRODUCT_IMAGE_ACCEPT}
                    multiple
                    disabled={isSubmitting}
                    onFiles={handleBulkImageFiles}
                    hint={`Upload multiple additional images (max ${PRODUCT_ADDITIONAL_IMAGES_MAX}, ${PRODUCT_IMAGE_HINT} each)`}
                  />
                  {errors.bulkImages && (
                    <div className="text-danger text-sm mt-1">{errors.bulkImages}</div>
                  )}
                  {bulkImagePreviews.length > 0 && (
                    <div className="mt-3">
                      <div className="row g-2">
                        {bulkImagePreviews.map((preview, index) => (
                          <div key={index} className="col-md-3 position-relative">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="img-thumbnail"
                              style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                            />
                            <button
                              type="button"
                              className="product-image-remove-btn"
                              onClick={() => removeBulkImage(index)}
                              disabled={isSubmitting}
                              aria-label="Remove image"
                              title="Remove image"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/products')}
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
                        Create Product
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <QuickAddCategoryModal
        open={showQuickAddCategory}
        onClose={() => setShowQuickAddCategory(false)}
        onCreated={handleQuickCategoryCreated}
      />

      <QuickAddBrandModal
        open={showQuickAddBrand}
        onClose={() => setShowQuickAddBrand(false)}
        onCreated={handleQuickBrandCreated}
      />
    </div>
  );
};

export default ProductAdd;
