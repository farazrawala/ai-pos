const BASE_URL = 'http://localhost:8000/api/';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

export const fetchCategoriesRequest = async () => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}category/get-all-active`, {
    method: 'GET',
    headers: headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();

  // Handle different response formats
  // If the API returns { data: [...] } or { categories: [...] } or just an array
  const categories = result.data || result.categories || result || [];
  return Array.isArray(categories) ? categories : [];
};
