import { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { createProduct } from '../../features/products/productsSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import { fetchBrandsRequest } from '../../features/brands/brandsAPI.js';

const ProductAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    product_code: '',
    description: '',
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
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);

  // Image states
  const [singleImage, setSingleImage] = useState(null);
  const [singleImagePreview, setSingleImagePreview] = useState(null);
  const [bulkImages, setBulkImages] = useState([]);
  const [bulkImagePreviews, setBulkImagePreviews] = useState([]);
  const singleImageInputRef = useRef(null);
  const bulkImagesInputRef = useRef(null);

  // Get product permissions
  const { canCreate } = usePermissions('product');

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
      } finally {
        setLoadingBrands(false);
      }
    };
    loadBrands();
  }, []);

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
    const { name, value, type } = e.target;
    setForm((prev) => {
      const updated = { ...prev };

      // Handle multiselect for categories
      if (name === 'categoryId' && type === 'select-multiple') {
        const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
        updated.categoryId = selectedOptions;
      } else if (name === 'categoryId' && type === 'select-one') {
        // Single select - convert to array
        updated.categoryId = value ? [value] : [];
      } else {
        updated[name] = value;
      }

      // Auto-generate slug from name
      if (name === 'name' && (!prev.slug || prev.slug === generateSlug(prev.name))) {
        updated.slug = generateSlug(value);
      }

      return updated;
    });
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Handle single image upload
  const handleSingleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        setErrors((prev) => ({
          ...prev,
          singleImage: 'Image size must be less than 5MB',
        }));
        return;
      }
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({
          ...prev,
          singleImage: 'Please select a valid image file',
        }));
        return;
      }
      setSingleImage(file);
      setErrors((prev) => ({ ...prev, singleImage: '' }));

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setSingleImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle bulk images upload
  const handleBulkImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 10) {
      setErrors((prev) => ({
        ...prev,
        bulkImages: 'Maximum 10 images allowed',
      }));
      return;
    }

    const validFiles = [];
    const invalidFiles = [];

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        invalidFiles.push(`${file.name} is larger than 5MB`);
      } else if (!file.type.startsWith('image/')) {
        invalidFiles.push(`${file.name} is not a valid image`);
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

    // Create previews
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
      newErrors.price = 'Valid price is required';
    }

    if (form.stock !== '' && (isNaN(form.stock) || parseInt(form.stock) < 0)) {
      newErrors.stock = 'Stock must be a valid number';
    }

    if (!form.categoryId || (Array.isArray(form.categoryId) && form.categoryId.length === 0)) {
      newErrors.categoryId = 'At least one category is required';
    }

    if (!form.unit) {
      newErrors.unit = 'Unit is required';
    }

    if (!form.product_type) {
      newErrors.product_type = 'Product type is required';
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
      // Prepare product data
      const productData = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
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
        tax_rate: form.tax_rate ? parseFloat(form.tax_rate) : undefined,
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

      setTimeout(() => {
        navigate('/products');
      }, 1000);
    } catch (error) {
      const errorMessage =
        error?.message || error || 'An error occurred while creating the product.';

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

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="card-header pb-0">
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
              <form onSubmit={handleSubmit}>
                {/* Name Field */}
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">
                    Product Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    id="name"
                    name="name"
                    placeholder="Enter product name"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>

                {/* Slug Field */}
                <div className="mb-3">
                  <label htmlFor="slug" className="form-label">
                    Slug
                  </label>
                  <input
                    type="text"
                    className={`form-control bg-light ${errors.slug ? 'is-invalid' : ''}`}
                    id="slug"
                    name="slug"
                    placeholder="product-slug"
                    value={form.slug}
                    readOnly
                  />
                  {errors.slug && <div className="invalid-feedback">{errors.slug}</div>}
                  <small className="text-muted">
                    URL-friendly version of the name. Auto-generated from name.
                  </small>
                </div>

                {/* Category Field - Multiselect */}
                <div className="mb-3">
                  <label htmlFor="categoryId" className="form-label">
                    Categories <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.categoryId ? 'is-invalid' : ''}`}
                    id="categoryId"
                    name="categoryId"
                    multiple
                    value={Array.isArray(form.categoryId) ? form.categoryId : []}
                    onChange={handleChange}
                    required
                    disabled={loadingCategories}
                    size="5"
                  >
                    {categories.map((cat) => (
                      <option key={cat._id || cat.id} value={cat._id || cat.id}>
                        {cat.name || cat.category_name}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && <div className="invalid-feedback">{errors.categoryId}</div>}
                  <small className="text-muted">Hold Ctrl/Cmd to select multiple categories</small>
                </div>

                {/* Product Type Field */}
                <div className="mb-3">
                  <label htmlFor="product_type" className="form-label">
                    Product Type <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.product_type ? 'is-invalid' : ''}`}
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
                    <div className="invalid-feedback">{errors.product_type}</div>
                  )}
                </div>

                {/* Brand Field */}
                <div className="mb-3">
                  <label htmlFor="brand_id" className="form-label">
                    Brand
                  </label>
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

                {/* Price, Wholesale Price, and Alert Qty Row */}
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label htmlFor="price" className="form-label">
                      Product Price <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`form-control ${errors.price ? 'is-invalid' : ''}`}
                      id="price"
                      name="price"
                      placeholder="0.00"
                      value={form.price}
                      onChange={handleChange}
                      required
                    />
                    {errors.price && <div className="invalid-feedback">{errors.price}</div>}
                  </div>
                  <div className="col-md-4 mb-3">
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
                  <div className="col-md-4 mb-3">
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
                    id="unit"
                    name="unit"
                    value={form.unit}
                    onChange={handleChange}
                    required
                  >
                    <option value="Piece">Piece</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Box">Box</option>
                    <option value="Meter">Meter</option>
                    <option value="Feet">Feet</option>
                    <option value="Yard">Yard</option>
                    <option value="Inch">Inch</option>
                    <option value="Centimeter">Centimeter</option>
                    <option value="Millimeter">Millimeter</option>
                    <option value="Others">Others</option>
                  </select>
                  {errors.unit && <div className="invalid-feedback">{errors.unit}</div>}
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

                {/* Dimension and Tax Rate Row */}
                <div className="row">
                  <div className="col-md-6 mb-3">
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
                  <div className="col-md-6 mb-3">
                    <label htmlFor="tax_rate" className="form-label">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="form-control"
                      id="tax_rate"
                      name="tax_rate"
                      placeholder="0.00"
                      value={form.tax_rate}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Description Field */}
                <div className="mb-3">
                  <label htmlFor="description" className="form-label">
                    Description
                  </label>
                  <textarea
                    className="form-control"
                    id="description"
                    name="description"
                    rows="4"
                    placeholder="Enter product description (optional)"
                    value={form.description}
                    onChange={handleChange}
                  />
                </div>

                {/* Single Image Upload */}
                <div className="mb-4">
                  <label className="form-label">Main Product Image</label>
                  <input
                    ref={singleImageInputRef}
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={handleSingleImageChange}
                    disabled={isSubmitting}
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
                        className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                        onClick={removeSingleImage}
                        disabled={isSubmitting}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                  <small className="text-muted">Upload a single main product image (max 5MB)</small>
                </div>

                {/* Bulk Images Upload */}
                <div className="mb-4">
                  <label className="form-label">Additional Product Images</label>
                  <input
                    ref={bulkImagesInputRef}
                    type="file"
                    className="form-control"
                    accept="image/*"
                    multiple
                    onChange={handleBulkImagesChange}
                    disabled={isSubmitting}
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
                              className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                              onClick={() => removeBulkImage(index)}
                              disabled={isSubmitting}
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <small className="text-muted">
                    Upload multiple additional images (max 10 images, 5MB each)
                  </small>
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

      {/* Toast Notifications */}
      <div className="position-fixed bottom-1 end-1 z-index-2">
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
          <div className="toast-body">Product created successfully!</div>
        </div>

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
          <div className="toast-body">An error occurred while creating the product.</div>
        </div>
      </div>
    </div>
  );
};

export default ProductAdd;
