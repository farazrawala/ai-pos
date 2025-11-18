import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

export const fetchProductsRequest = async (params = {}) => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Build query string with pagination, search, and sort parameters
  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', skip);
  }
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params.categoryId) queryParams.append('categoryId', params.categoryId);

  const queryString = queryParams.toString();
  const url = `${BASE_URL}product/get-all-active${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();

  // Handle API response format with pagination
  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const data = result.data || result.products || [];

    const page = pagination.limit > 0 ? Math.floor(pagination.skip / pagination.limit) + 1 : 1;
    const totalPages = pagination.limit > 0 ? Math.ceil(pagination.total / pagination.limit) : 0;

    return {
      data: Array.isArray(data) ? data : [],
      total: pagination.total || 0,
      page: page,
      limit: pagination.limit || params.limit || 10,
      totalPages: totalPages,
    };
  }

  // Fallback formats
  if (result.data && Array.isArray(result.data)) {
    return {
      data: result.data,
      total: result.total || result.data.length,
      page: result.page || params.page || 1,
      limit: result.limit || result.per_page || params.limit || 10,
      totalPages:
        result.total_pages ||
        Math.ceil(
          (result.total || result.data.length) /
            (result.limit || result.per_page || params.limit || 10)
        ),
    };
  } else if (result.products && Array.isArray(result.products)) {
    return {
      data: result.products,
      total: result.total || result.products.length,
      page: result.page || params.page || 1,
      limit: result.limit || result.per_page || params.limit || 10,
      totalPages:
        result.total_pages ||
        Math.ceil(
          (result.total || result.products.length) /
            (result.limit || result.per_page || params.limit || 10)
        ),
    };
  } else if (Array.isArray(result)) {
    return {
      data: result,
      total: result.length,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(result.length / (params.limit || 10)),
    };
  }

  return {
    data: [],
    total: 0,
    page: params.page || 1,
    limit: params.limit || 10,
    totalPages: 0,
  };
};

export const fetchProductByIdRequest = async (productId) => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}product/get/${productId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result;
};

export const createProductRequest = async (productData, images = []) => {
  const token = getAuthToken();

  // Map frontend field names to backend field names
  const mapFieldNames = (data) => {
    const mapped = { ...data };

    // Required fields mapping
    if (mapped.name !== undefined) {
      mapped.product_name = mapped.name;
      delete mapped.name;
    }
    if (mapped.price !== undefined) {
      mapped.product_price = String(mapped.price); // Backend expects String
      delete mapped.price;
    }
    if (mapped.slug !== undefined) {
      mapped.product_slug = mapped.slug;
      delete mapped.slug;
    }
    if (mapped.description !== undefined) {
      mapped.product_description = mapped.description;
      delete mapped.description;
    }

    // Category mapping (can be single ID or array)
    if (mapped.categoryId !== undefined) {
      if (Array.isArray(mapped.categoryId)) {
        mapped.category_id = mapped.categoryId;
      } else {
        mapped.category_id = [mapped.categoryId];
      }
      delete mapped.categoryId;
    }

    // Image fields (handled separately in FormData)
    if (mapped.image !== undefined) {
      mapped.product_image = mapped.image;
      delete mapped.image;
    }
    if (mapped.images !== undefined) {
      mapped.multi_images = mapped.images;
      delete mapped.images;
    }

    return mapped;
  };

  const mappedProductData = mapFieldNames(productData);

  // If images are provided, use FormData
  if (images && images.length > 0) {
    const formData = new FormData();

    // Add product data fields with mapped names
    Object.keys(mappedProductData).forEach((key) => {
      if (
        key !== 'images' &&
        key !== 'product_image' &&
        key !== 'multi_images' &&
        mappedProductData[key] !== undefined &&
        mappedProductData[key] !== null
      ) {
        // Convert value to string for FormData (backend expects strings for .trim())
        const value = mappedProductData[key];
        // Handle arrays (like category_id)
        if (Array.isArray(value)) {
          value.forEach((item, idx) => {
            formData.append(`${key}[${idx}]`, String(item));
          });
        } else {
          formData.append(key, typeof value === 'string' ? value : String(value));
        }
      }
    });

    // Handle images: first image as product_image, rest as multi_images
    if (images.length > 0) {
      const firstImage = images[0];
      if (firstImage instanceof File) {
        formData.append('product_image', firstImage);
      } else if (typeof firstImage === 'string') {
        formData.append('product_image', firstImage);
      }
    }

    // Add remaining images as multi_images
    if (images.length > 1) {
      images.slice(1).forEach((image) => {
        if (image instanceof File) {
          formData.append('multi_images', image);
        } else if (typeof image === 'string') {
          formData.append('multi_images', image);
        }
      });
    }

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BASE_URL}product/create`;

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } else {
    // No images, use JSON
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BASE_URL}product/create`;

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(mappedProductData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  }
};

export const updateProductRequest = async (productId, productData, images = []) => {
  const token = getAuthToken();

  // Map frontend field names to backend field names
  const mapFieldNames = (data) => {
    const mapped = { ...data };

    // Required fields mapping
    if (mapped.name !== undefined) {
      mapped.product_name = mapped.name;
      delete mapped.name;
    }
    if (mapped.price !== undefined) {
      mapped.product_price = String(mapped.price); // Backend expects String
      delete mapped.price;
    }
    if (mapped.slug !== undefined) {
      mapped.product_slug = mapped.slug;
      delete mapped.slug;
    }
    if (mapped.description !== undefined) {
      mapped.product_description = mapped.description;
      delete mapped.description;
    }

    // Category mapping (can be single ID or array)
    if (mapped.categoryId !== undefined) {
      if (Array.isArray(mapped.categoryId)) {
        mapped.category_id = mapped.categoryId;
      } else {
        mapped.category_id = [mapped.categoryId];
      }
      delete mapped.categoryId;
    }

    // Image fields (handled separately in FormData)
    if (mapped.image !== undefined) {
      mapped.product_image = mapped.image;
      delete mapped.image;
    }
    if (mapped.images !== undefined) {
      mapped.multi_images = mapped.images;
      delete mapped.images;
    }

    return mapped;
  };

  const requestData = mapFieldNames(productData);

  // If images are provided, use FormData
  if (images && images.length > 0) {
    const formData = new FormData();

    // Add product data fields
    Object.keys(requestData).forEach((key) => {
      if (
        key !== 'images' &&
        key !== 'product_image' &&
        key !== 'multi_images' &&
        requestData[key] !== undefined &&
        requestData[key] !== null
      ) {
        // Convert value to string for FormData (backend expects strings for .trim())
        const value = requestData[key];
        // Handle arrays (like category_id)
        if (Array.isArray(value)) {
          value.forEach((item, idx) => {
            formData.append(`${key}[${idx}]`, String(item));
          });
        } else {
          formData.append(key, typeof value === 'string' ? value : String(value));
        }
      }
    });

    // Handle images: first image as product_image, rest as multi_images
    if (images.length > 0) {
      const firstImage = images[0];
      if (firstImage instanceof File) {
        formData.append('product_image', firstImage);
      } else if (typeof firstImage === 'string') {
        formData.append('product_image', firstImage);
      }
    }

    // Add remaining images as multi_images
    if (images.length > 1) {
      images.slice(1).forEach((image) => {
        if (image instanceof File) {
          formData.append('multi_images', image);
        } else if (typeof image === 'string') {
          formData.append('multi_images', image);
        }
      });
    }

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BASE_URL}product/update/${productId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } else {
    // No images, use JSON
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BASE_URL}product/update/${productId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  }
};

export const deleteProductRequest = async (productId) => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}product/delete/${productId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  try {
    const result = await response.json();
    return result;
  } catch {
    return { success: true };
  }
};

// Upload single image
export const uploadProductImageRequest = async (productId, imageFile) => {
  const token = getAuthToken();

  const formData = new FormData();
  formData.append('image', imageFile);

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}product/upload-image/${productId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result;
};

// Upload bulk images
export const uploadBulkProductImagesRequest = async (productId, imageFiles) => {
  const token = getAuthToken();

  const formData = new FormData();
  imageFiles.forEach((file) => {
    formData.append('images', file);
  });

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}product/upload-images/${productId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result;
};
