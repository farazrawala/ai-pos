import { useState, useEffect } from 'react';
import { getSyncStatus, subscribeSyncStatus } from '../offline/syncStatus.js';

export function useSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  return status;
}
