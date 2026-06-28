import { useState, useEffect } from 'react';

function readNavigatorOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Tracks browser online/offline state via navigator.onLine and window events.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(readNavigatorOnline);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
