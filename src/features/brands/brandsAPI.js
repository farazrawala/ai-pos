import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

export const fetchBrandsRequest = async (params = {}) => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', skip);
  }
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);

  const queryString = queryParams.toString();
  const url = `${BASE_URL}brand/get-all-active${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();

  // Handle API response format
  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const data = result.data || result.brands || [];

    return {
      data: Array.isArray(data) ? data : [],
      total: pagination.total || 0,
    };
  }

  // Fallback formats
  if (result.data && Array.isArray(result.data)) {
    return {
      data: result.data,
      total: result.total || result.data.length,
    };
  } else if (result.brands && Array.isArray(result.brands)) {
    return {
      data: result.brands,
      total: result.total || result.brands.length,
    };
  } else if (Array.isArray(result)) {
    return {
      data: result,
      total: result.length,
    };
  }

  return {
    data: [],
    total: 0,
  };
};
