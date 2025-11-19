import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import {
  fetchProductById,
  updateProduct,
  clearUpdateStatus,
  clearCurrentProduct,
} from '../../features/products/productsSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import { fetchBrandsRequest } from '../../features/brands/brandsAPI.js';
import { fetchAttributesRequest } from '../../features/attributes/attributesAPI.js';

const ProductEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentProduct, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.products
  );

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
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);

  // Image states
  const [singleImage, setSingleImage] = useState(null);
  const [singleImagePreview, setSingleImagePreview] = useState(null);
  const [existingSingleImage, setExistingSingleImage] = useState(null);
  const [bulkImages, setBulkImages] = useState([]);
  const [bulkImagePreviews, setBulkImagePreviews] = useState([]);
  const [existingBulkImages, setExistingBulkImages] = useState([]);
  const singleImageInputRef = useRef(null);
  const bulkImagesInputRef = useRef(null);

  // Modal state for variations management
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [attributes, setAttributes] = useState([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [selectedAttributes, setSelectedAttributes] = useState({}); // { attributeId: [valueNames] }
  const [variations, setVariations] = useState([]); // Array of variation objects

  const isSubmitting = updateStatus === 'loading';
  const isLoading = fetchStatus === 'loading';

  // Get product permissions
  const { canEdit } = usePermissions('product');

  // Redirect if user doesn't have edit permission
  useEffect(() => {
    if (canEdit === false) {
      navigate('/products');
    }
  }, [canEdit, navigate]);

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

  // Fetch attributes when modal opens
  useEffect(() => {
    if (showVariationsModal) {
      const loadAttributes = async () => {
        setLoadingAttributes(true);
        try {
          const result = await fetchAttributesRequest({ page: 1, limit: 1000 });
          setAttributes(result.data || []);
        } catch (error) {
          console.error('Failed to load attributes:', error);
        } finally {
          setLoadingAttributes(false);
        }
      };
      loadAttributes();
    }
  }, [showVariationsModal]);

  // Fetch product data on mount
  useEffect(() => {
    if (id) {
      dispatch(fetchProductById(id));
    }
    return () => {
      dispatch(clearCurrentProduct());
    };
  }, [dispatch, id]);

  // Populate form when product data is loaded
  useEffect(() => {
    if (currentProduct && fetchStatus === 'succeeded') {
      // Handle category_id - can be array or single value
      let categoryIds = [];
      if (currentProduct.category_id) {
        categoryIds = Array.isArray(currentProduct.category_id)
          ? currentProduct.category_id
          : [currentProduct.category_id];
      } else if (currentProduct.categoryId) {
        categoryIds = Array.isArray(currentProduct.categoryId)
          ? currentProduct.categoryId
          : [currentProduct.categoryId];
      }

      setForm({
        name: currentProduct.name || currentProduct.product_name || '',
        slug: currentProduct.slug || currentProduct.product_slug || '',
        product_code: currentProduct.product_code || '',
        description: currentProduct.description || currentProduct.product_description || '',
        price: currentProduct.price || currentProduct.product_price || '',
        alert_qty: currentProduct.alert_qty !== undefined ? currentProduct.alert_qty : '',
        brand_id: currentProduct.brand_id || '',
        unit: currentProduct.unit || 'Piece',
        weight: currentProduct.weight !== undefined ? currentProduct.weight : '',
        length: currentProduct.length !== undefined ? currentProduct.length : '',
        width: currentProduct.width !== undefined ? currentProduct.width : '',
        height: currentProduct.height !== undefined ? currentProduct.height : '',
        dimension: currentProduct.dimension || '',
        tax_rate: currentProduct.tax_rate !== undefined ? currentProduct.tax_rate : '',
        barcode: currentProduct.barcode || '',
        sku: currentProduct.sku || '',
        product_type: currentProduct.product_type || 'Single',
        categoryId: categoryIds,
        wholesale_price:
          currentProduct.wholesale_price !== undefined ? currentProduct.wholesale_price : '',
      });

      // Set existing images - handle product_image and multi_images
      if (currentProduct.product_image) {
        setExistingSingleImage(currentProduct.product_image);
      } else if (currentProduct.images && currentProduct.images.length > 0) {
        setExistingSingleImage(currentProduct.images[0]);
        if (currentProduct.images.length > 1) {
          setExistingBulkImages(currentProduct.images.slice(1));
        }
      } else if (currentProduct.image) {
        setExistingSingleImage(currentProduct.image);
      }

      // Handle multi_images
      if (
        currentProduct.multi_images &&
        Array.isArray(currentProduct.multi_images) &&
        currentProduct.multi_images.length > 0
      ) {
        setExistingBulkImages(currentProduct.multi_images);
      }
    }
  }, [currentProduct, fetchStatus]);

  // Auto-generate slug from name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Calculate all combinations of selected attribute values
  const calculateCombinations = (selectedAttrs) => {
    const attributeArrays = [];

    // Get selected attributes with their values
    Object.keys(selectedAttrs).forEach((attrId) => {
      const selectedValues = selectedAttrs[attrId];
      if (selectedValues && selectedValues.length > 0) {
        const attribute = attributes.find((a) => (a._id || a.id) === attrId);
        if (attribute) {
          const values = attribute.attribute_values || [];
          const filteredValues = values.filter((v) => selectedValues.includes(v.name || v));
          if (filteredValues.length > 0) {
            attributeArrays.push({
              attributeId: attrId,
              attributeName: attribute.name,
              values: filteredValues,
            });
          }
        }
      }
    });

    if (attributeArrays.length === 0) return [];

    // Calculate cartesian product
    const combinations = [];
    const generateCombinations = (current, index) => {
      if (index === attributeArrays.length) {
        combinations.push([...current]);
        return;
      }
      attributeArrays[index].values.forEach((value) => {
        generateCombinations([...current, value], index + 1);
      });
    };
    generateCombinations([], 0);

    return combinations.map((combo, idx) => {
      const variationName = combo.map((v) => v.name || v).join(' - ');
      const variationSlug = generateSlug(variationName);
      return {
        id: `var_${idx}`,
        name: variationName,
        slug: variationSlug,
        price: '',
        qty: '',
        image: null,
        imagePreview: null,
        attributes: combo.map((v, i) => ({
          attributeId: attributeArrays[i].attributeId,
          attributeName: attributeArrays[i].attributeName,
          value: v.name || v,
        })),
      };
    });
  };

  // Handle attribute selection change with toggle support
  const handleAttributeChange = (attributeId, selectedValues) => {
    const newSelected = { ...selectedAttributes };
    if (selectedValues.length === 0) {
      delete newSelected[attributeId];
    } else {
      newSelected[attributeId] = selectedValues;
    }
    setSelectedAttributes(newSelected);

    // Calculate and update variations using current attributes
    const attributeArrays = [];
    Object.keys(newSelected).forEach((attrId) => {
      const values = newSelected[attrId];
      if (values && values.length > 0) {
        const attribute = attributes.find((a) => (a._id || a.id) === attrId);
        if (attribute) {
          const attrValues = attribute.attribute_values || [];
          const filteredValues = attrValues.filter((v) => values.includes(v.name || v));
          if (filteredValues.length > 0) {
            attributeArrays.push({
              attributeId: attrId,
              attributeName: attribute.name,
              values: filteredValues,
            });
          }
        }
      }
    });

    if (attributeArrays.length === 0) {
      setVariations([]);
      return;
    }

    // Calculate cartesian product
    const combinations = [];
    const generateCombinations = (current, index) => {
      if (index === attributeArrays.length) {
        combinations.push([...current]);
        return;
      }
      attributeArrays[index].values.forEach((value) => {
        generateCombinations([...current, value], index + 1);
      });
    };
    generateCombinations([], 0);

    const newVariations = combinations.map((combo, idx) => {
      const variationName = combo.map((v) => v.name || v).join(' - ');
      const variationSlug = generateSlug(variationName);
      return {
        id: `var_${idx}`,
        name: variationName,
        slug: variationSlug,
        price: '',
        qty: '',
        image: null,
        imagePreview: null,
        attributes: combo.map((v, i) => ({
          attributeId: attributeArrays[i].attributeId,
          attributeName: attributeArrays[i].attributeName,
          value: v.name || v,
        })),
      };
    });
    setVariations(newVariations);
  };

  // Handle variation field change
  const handleVariationChange = (variationId, field, value) => {
    setVariations((prev) => prev.map((v) => (v.id === variationId ? { ...v, [field]: value } : v)));
  };

  // Handle variation image change
  const handleVariationImageChange = (variationId, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVariations((prev) =>
          prev.map((v) =>
            v.id === variationId ? { ...v, image: file, imagePreview: reader.result } : v
          )
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove variation
  const handleRemoveVariation = (variationId) => {
    setVariations((prev) => prev.filter((v) => v.id !== variationId));
  };

  // Close modal and reset state (but keep variations)
  const handleCloseModal = () => {
    setShowVariationsModal(false);
    // Keep variations and selectedAttributes so they persist on the main page
    // Only close the modal
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
      setExistingSingleImage(null); // Clear existing image when new one is selected

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
    setExistingBulkImages([]); // Clear existing images when new ones are selected

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
    setExistingSingleImage(null);
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
  };

  // Remove existing bulk image
  const removeExistingBulkImage = (index) => {
    const newImages = existingBulkImages.filter((_, i) => i !== index);
    setExistingBulkImages(newImages);
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

    // Validate form
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
    if (!form.categoryId || (Array.isArray(form.categoryId) && form.categoryId.length === 0)) {
      newErrors.categoryId = 'At least one category is required';
    }
    if (!form.unit) {
      newErrors.unit = 'Unit is required';
    }
    if (!form.product_type) {
      newErrors.product_type = 'Product type is required';
    }

    // If there are validation errors, show them and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);

      // Show toast for validation errors
      const errorMessages = Object.entries(newErrors).map(([key, value]) => {
        const fieldName = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
        return `${fieldName}: ${value}`;
      });
      const errorMessage = `Please fix the following errors:\n${errorMessages.join('\n')}`;

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
            delay: 8000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 8000);
        }
      }
      return;
    }

    // Clear any previous errors
    setErrors({});

    try {
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

      // Prepare images array
      const images = [];
      if (singleImage) {
        images.push(singleImage);
      }
      // Include existing images that weren't removed
      if (existingSingleImage && !singleImage) {
        images.push(existingSingleImage);
      }
      if (bulkImages.length > 0) {
        images.push(...bulkImages);
      }
      if (existingBulkImages.length > 0) {
        images.push(...existingBulkImages);
      }

      await dispatch(updateProduct({ productId: id, productData, images })).unwrap();

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
        dispatch(clearUpdateStatus());
      }, 5500);

      setTimeout(() => {
        navigate('/products');
      }, 1000);
    } catch (error) {
      console.error('Update product error:', error);

      // Extract detailed error message
      let errorMessage = 'An error occurred while updating the product.';

      if (error) {
        // Handle different error formats
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (error?.payload) {
          // Redux Toolkit rejectWithValue format
          if (typeof error.payload === 'string') {
            errorMessage = error.payload;
          } else if (error.payload?.message) {
            errorMessage = error.payload.message;
          } else if (error.payload?.error) {
            errorMessage = error.payload.error;
          } else if (Array.isArray(error.payload)) {
            // Handle array of errors
            errorMessage = error.payload.join(', ');
          } else if (typeof error.payload === 'object') {
            // Handle object with error details
            const errorDetails = Object.entries(error.payload)
              .map(([key, value]) => {
                if (Array.isArray(value)) {
                  return `${key}: ${value.join(', ')}`;
                }
                return `${key}: ${value}`;
              })
              .join('\n');
            errorMessage = errorDetails || JSON.stringify(error.payload);
          }
        } else if (error?.error) {
          errorMessage = error.error;
        } else if (error?.response?.data) {
          // Axios error format
          const data = error.response.data;
          if (data.message) {
            errorMessage = data.message;
          } else if (data.error) {
            errorMessage = data.error;
          } else if (Array.isArray(data.errors)) {
            errorMessage = data.errors.join(', ');
          } else if (typeof data === 'object') {
            const errorDetails = Object.entries(data)
              .map(([key, value]) => {
                if (Array.isArray(value)) {
                  return `${key}: ${value.join(', ')}`;
                }
                return `${key}: ${value}`;
              })
              .join('\n');
            errorMessage = errorDetails || JSON.stringify(data);
          }
        }
      }

      // Show error toast
      const toastElement = document.getElementById('dangerToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        const toastBody = toastElement.querySelector('.toast-body');
        if (toastBody) {
          // Format error message for display (handle newlines)
          const formattedMessage = errorMessage.replace(/\n/g, '<br>');
          toastBody.innerHTML = formattedMessage;
        }

        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 10000, // Show longer for detailed errors
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 10000);
        }
      } else {
        // Fallback: alert if toast element not found
        console.error('Toast element not found, showing alert:', errorMessage);
        alert(`Error: ${errorMessage}`);
      }

      setTimeout(() => {
        dispatch(clearUpdateStatus());
      }, 10500);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="row mt-4">
          <div className="col-12" style={{ padding: '20px' }}>
            <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div className="card-body text-center p-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading product data...</p>
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
            <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div className="card-body">
                <div className="alert alert-danger" role="alert">
                  <h5 className="alert-heading">Error Loading Product</h5>
                  <p>{fetchError || 'Failed to load product data.'}</p>
                  <hr />
                  <button className="btn btn-outline-danger" onClick={() => navigate('/products')}>
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
          <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Edit Product</h5>
                  <p className="text-sm mb-0">Update product information and images</p>
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  />
                  {errors.slug && <div className="invalid-feedback">{errors.slug}</div>}
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
                    disabled={isSubmitting || loadingCategories}
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
                    disabled={isSubmitting || loadingBrands}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  />
                </div>

                {/* Single Image Upload */}
                <div className="mb-4">
                  <label className="form-label">Main Product Image</label>
                  {existingSingleImage && !singleImagePreview && (
                    <div className="mb-2 position-relative" style={{ width: '200px' }}>
                      <img
                        src={existingSingleImage}
                        alt="Current"
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
                      <small className="text-muted d-block mt-1">Current image</small>
                    </div>
                  )}
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
                        alt="New preview"
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
                      <small className="text-muted d-block mt-1">
                        New image (will replace current)
                      </small>
                    </div>
                  )}
                  <small className="text-muted">Upload a single main product image (max 5MB)</small>
                </div>

                {/* Bulk Images Upload */}
                <div className="mb-4">
                  <label className="form-label">Additional Product Images</label>
                  {existingBulkImages.length > 0 && bulkImagePreviews.length === 0 && (
                    <div className="mb-3">
                      <div className="row g-2">
                        {existingBulkImages.map((img, index) => (
                          <div key={index} className="col-md-3 position-relative">
                            <img
                              src={img}
                              alt={`Existing ${index + 1}`}
                              className="img-thumbnail"
                              style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                              onClick={() => removeExistingBulkImage(index)}
                              disabled={isSubmitting}
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                      <small className="text-muted">Current additional images</small>
                    </div>
                  )}
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
                              alt={`New preview ${index + 1}`}
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
                      <small className="text-muted">New images (will be added to existing)</small>
                    </div>
                  )}
                  <small className="text-muted">
                    Upload multiple additional images (max 10 images, 5MB each)
                  </small>
                </div>

                {/* Product Type Field */}
                <div className="mb-4">
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
                    disabled={isSubmitting}
                  >
                    <option value="Single">Single</option>
                    <option value="Variable">Variable</option>
                  </select>
                  {errors.product_type && (
                    <div className="invalid-feedback">{errors.product_type}</div>
                  )}
                  {/* Manage Variations Button - Only show when Product Type is Variable */}
                  {form.product_type === 'Variable' && (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => setShowVariationsModal(true)}
                        disabled={isSubmitting}
                      >
                        <i className="fas fa-cog me-1"></i>
                        Manage Variations
                      </button>
                    </div>
                  )}
                </div>

                {/* Variations Display Section - Show on main page */}
                {form.product_type === 'Variable' && variations.length > 0 && (
                  <div className="mb-4">
                    <h6 className="mb-3">
                      <i className="fas fa-list me-2"></i>
                      Product Variations ({variations.length} total)
                    </h6>
                    <div className="row g-3">
                      {variations.map((variation) => (
                        <div key={variation.id} className="col-md-6 col-lg-4">
                          <div className="card h-100 position-relative">
                            <button
                              type="button"
                              className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2"
                              style={{ zIndex: 10 }}
                              onClick={() => handleRemoveVariation(variation.id)}
                              disabled={isSubmitting}
                              title="Remove variation"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                            <div className="card-body">
                              <h6 className="card-title text-primary mb-3">{variation.name}</h6>

                              {/* Variation Image */}
                              <div className="mb-3">
                                <label className="form-label small">Image</label>
                                <input
                                  type="file"
                                  className="form-control form-control-sm"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      handleVariationImageChange(variation.id, file);
                                    }
                                  }}
                                  disabled={isSubmitting}
                                />
                                {variation.imagePreview && (
                                  <img
                                    src={variation.imagePreview}
                                    alt={variation.name}
                                    className="img-thumbnail mt-2"
                                    style={{
                                      width: '100%',
                                      maxHeight: '100px',
                                      objectFit: 'cover',
                                    }}
                                  />
                                )}
                              </div>

                              {/* Variation Name */}
                              <div className="mb-2">
                                <label className="form-label small">Name</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={variation.name}
                                  onChange={(e) =>
                                    handleVariationChange(variation.id, 'name', e.target.value)
                                  }
                                  disabled={isSubmitting}
                                />
                              </div>

                              {/* Variation Slug */}
                              <div className="mb-2">
                                <label className="form-label small">Slug</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm bg-light"
                                  value={variation.slug}
                                  onChange={(e) =>
                                    handleVariationChange(variation.id, 'slug', e.target.value)
                                  }
                                  disabled={isSubmitting}
                                />
                              </div>

                              {/* Price and Quantity Row */}
                              <div className="row g-2">
                                <div className="col-6">
                                  <label className="form-label small">Price</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-control form-control-sm"
                                    placeholder="0.00"
                                    value={variation.price}
                                    onChange={(e) =>
                                      handleVariationChange(variation.id, 'price', e.target.value)
                                    }
                                    disabled={isSubmitting}
                                  />
                                </div>
                                <div className="col-6">
                                  <label className="form-label small">Quantity</label>
                                  <input
                                    type="number"
                                    min="0"
                                    className="form-control form-control-sm"
                                    placeholder="0"
                                    value={variation.qty}
                                    onChange={(e) =>
                                      handleVariationChange(variation.id, 'qty', e.target.value)
                                    }
                                    disabled={isSubmitting}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                        Updating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-2"></i>
                        Update Product
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
          <div className="toast-body">Product updated successfully!</div>
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
          <div className="toast-body">An error occurred while updating the product.</div>
        </div>
      </div>

      {/* Variations Management Modal */}
      {showVariationsModal && (
        <>
          <div
            className="modal fade show"
            style={{ display: 'block', zIndex: 1055 }}
            tabIndex="-1"
            role="dialog"
            aria-labelledby="variationsModalLabel"
            aria-hidden="false"
          >
            <div
              className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
              role="document"
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="variationsModalLabel">
                    <i className="fas fa-cog me-2"></i>
                    Manage Product Variations
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleCloseModal}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <p className="text-muted mb-3">
                    Manage variations for: <strong>{form.name || 'Product'}</strong>
                  </p>

                  {/* Attribute Selection Section */}
                  <div className="mb-4">
                    <h6 className="mb-3">
                      <i className="fas fa-tags me-2"></i>Select Attributes
                    </h6>
                    {loadingAttributes ? (
                      <div className="text-center py-3">
                        <div
                          className="spinner-border spinner-border-sm text-primary"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted mt-2">Loading attributes...</p>
                      </div>
                    ) : attributes.length === 0 ? (
                      <div className="alert alert-warning">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        No attributes available. Please create attributes first.
                      </div>
                    ) : (
                      <div className="row g-3">
                        {attributes.map((attribute) => {
                          const attributeId = attribute._id || attribute.id;
                          const selectedValues = selectedAttributes[attributeId] || [];
                          const attributeValues = attribute.attribute_values || [];

                          return (
                            <div key={attributeId} className="col-md-6">
                              <label className="form-label fw-bold">{attribute.name}</label>
                              <div
                                className="border rounded p-2"
                                style={{
                                  maxHeight: '200px',
                                  overflowY: 'auto',
                                  minHeight: '100px',
                                }}
                              >
                                {attributeValues.map((value, idx) => {
                                  const valueName = value.name || value;
                                  const isSelected = selectedValues.includes(valueName);
                                  return (
                                    <div key={idx} className="form-check">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`attr-${attributeId}-${idx}`}
                                        checked={isSelected}
                                        onChange={(e) => {
                                          const newValues = e.target.checked
                                            ? [...selectedValues, valueName]
                                            : selectedValues.filter((v) => v !== valueName);
                                          handleAttributeChange(attributeId, newValues);
                                        }}
                                      />
                                      <label
                                        className="form-check-label"
                                        htmlFor={`attr-${attributeId}-${idx}`}
                                        style={{ cursor: 'pointer' }}
                                      >
                                        {valueName}
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                              <small className="text-muted">Click to select/deselect values</small>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Variations Display Section */}
                  {variations.length > 0 && (
                    <div className="mb-4">
                      <h6 className="mb-3">
                        <i className="fas fa-list me-2"></i>
                        Variations ({variations.length} total)
                      </h6>
                      <div className="row g-3">
                        {variations.map((variation) => (
                          <div key={variation.id} className="col-md-6 col-lg-4">
                            <div className="card h-100 position-relative">
                              <button
                                type="button"
                                className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2"
                                style={{ zIndex: 10 }}
                                onClick={() => handleRemoveVariation(variation.id)}
                                title="Remove variation"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                              <div className="card-body">
                                <h6 className="card-title text-primary mb-3">{variation.name}</h6>

                                {/* Variation Image */}
                                <div className="mb-3">
                                  <label className="form-label small">Image</label>
                                  <input
                                    type="file"
                                    className="form-control form-control-sm"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) {
                                        handleVariationImageChange(variation.id, file);
                                      }
                                    }}
                                  />
                                  {variation.imagePreview && (
                                    <img
                                      src={variation.imagePreview}
                                      alt={variation.name}
                                      className="img-thumbnail mt-2"
                                      style={{
                                        width: '100%',
                                        maxHeight: '100px',
                                        objectFit: 'cover',
                                      }}
                                    />
                                  )}
                                </div>

                                {/* Variation Name */}
                                <div className="mb-2">
                                  <label className="form-label small">Name</label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={variation.name}
                                    onChange={(e) =>
                                      handleVariationChange(variation.id, 'name', e.target.value)
                                    }
                                  />
                                </div>

                                {/* Variation Slug */}
                                <div className="mb-2">
                                  <label className="form-label small">Slug</label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm bg-light"
                                    value={variation.slug}
                                    onChange={(e) =>
                                      handleVariationChange(variation.id, 'slug', e.target.value)
                                    }
                                  />
                                </div>

                                {/* Price and Quantity Row */}
                                <div className="row g-2">
                                  <div className="col-6">
                                    <label className="form-label small">Price</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="form-control form-control-sm"
                                      placeholder="0.00"
                                      value={variation.price}
                                      onChange={(e) =>
                                        handleVariationChange(variation.id, 'price', e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="col-6">
                                    <label className="form-label small">Quantity</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="form-control form-control-sm"
                                      placeholder="0"
                                      value={variation.qty}
                                      onChange={(e) =>
                                        handleVariationChange(variation.id, 'qty', e.target.value)
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {variations.length === 0 && Object.keys(selectedAttributes).length > 0 && (
                    <div className="alert alert-info">
                      <i className="fas fa-info-circle me-2"></i>
                      Select attribute values to generate variations.
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      // TODO: Save variations
                      console.log('Save variations for product:', id, variations);
                      handleCloseModal();
                    }}
                  >
                    <i className="fas fa-save me-1"></i>
                    Save Variations
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1050 }}
            onClick={handleCloseModal}
          ></div>
        </>
      )}
    </div>
  );
};

export default ProductEdit;
