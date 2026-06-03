import { useEffect, useState } from 'react';
import { fetchTotalCustomersRequest } from '../features/users/usersAPI.js';

export function useTotalCustomers() {
  const [state, setState] = useState({
    loading: true,
    customerCount: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { customerCount } = await fetchTotalCustomersRequest();
        if (cancelled) return;
        setState({ loading: false, customerCount, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          customerCount: null,
          error: e?.message || 'Could not load customers',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
