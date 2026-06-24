import { useEffect, useState } from 'react';
import { fetchProductsRequest } from '../features/products/productsAPI.js';
import { pickLowStockProducts } from '../utils/lowStockProducts.js';

const FETCH_LIMIT = 500;
const DISPLAY_LIMIT = 20;

export function useLowStockProducts() {
  const [state, setState] = useState({
    loading: true,
    items: [],
    totalScanned: 0,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const response = await fetchProductsRequest({ page: 1, limit: FETCH_LIMIT });
        if (cancelled) return;

        const products = Array.isArray(response.data) ? response.data : [];
        setState({
          loading: false,
          items: pickLowStockProducts(products, DISPLAY_LIMIT),
          totalScanned: products.length,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          items: [],
          totalScanned: 0,
          error: e?.message || 'Could not load low stock alerts',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
