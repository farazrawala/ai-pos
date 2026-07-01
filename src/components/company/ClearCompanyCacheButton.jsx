import { useState } from 'react';
import { removeCompanyCacheRequest } from '../../features/company/companyAPI.js';

const DEFAULT_CONFIRM =
  'Clear all list-cache entries for your company? List APIs will refetch from the database on next request.';

export default function ClearCompanyCacheButton({
  onCleared,
  onError,
  className = 'btn btn-sm btn-outline-warning mb-0',
  disabled = false,
  confirmMessage = DEFAULT_CONFIRM,
  reloadOnSuccess = true,
}) {
  const [clearing, setClearing] = useState(false);

  const handleClick = async () => {
    if (!window.confirm(confirmMessage)) return;

    setClearing(true);
    try {
      const data = await removeCompanyCacheRequest();
      onCleared?.(data);
      if (reloadOnSuccess) {
        window.location.reload();
        return;
      }
    } catch (err) {
      onError?.(err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={disabled || clearing}
      title="Clear company list cache"
    >
      {clearing ? 'Clearing…' : 'Clear cache'}
    </button>
  );
}
