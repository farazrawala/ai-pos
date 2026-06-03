import { useEffect, useState } from 'react';
import { fetchTotalUsersRequest } from '../features/users/usersAPI.js';

export function useTotalUsers() {
  const [state, setState] = useState({
    loading: true,
    userCount: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { userCount } = await fetchTotalUsersRequest();
        if (cancelled) return;
        setState({ loading: false, userCount, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          userCount: null,
          error: e?.message || 'Could not load users',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
