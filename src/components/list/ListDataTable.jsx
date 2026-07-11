import TablePagination from '../TablePagination.jsx';
import FetchRetryStatus from './FetchRetryStatus.jsx';
import { useFetchRetryCountdown } from '../../hooks/useFetchRetryCountdown.js';

/**
 * Standard list page table shell: horizontal scroll, styled table, footer pagination.
 * Pass `onRetry` to auto-retry failed loads with a countdown (default 5s).
 */
const ListDataTable = ({
  loading = false,
  loadingLabel = 'Loading…',
  error = null,
  errorPrefix = 'Error loading data',
  onRetry = null,
  retrySeconds = 5,
  autoRetry = true,
  retryMessage = 'we are trying to load please wait.',
  pagination,
  onPageChange,
  onLimitChange,
  selectId = 'table-page-size',
  showPagination = true,
  className = '',
  children,
}) => {
  const canAutoRetry = Boolean(autoRetry && typeof onRetry === 'function' && error);
  const { countdown, isRetrying } = useFetchRetryCountdown({
    isFailed: Boolean(error),
    onRetry,
    seconds: retrySeconds,
    enabled: canAutoRetry,
  });

  if (loading) {
    return (
      <div className="text-center py-5 px-3">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
        <p className="text-sm text-muted mt-3 mb-0">{loadingLabel}</p>
      </div>
    );
  }

  if (isRetrying) {
    return <FetchRetryStatus countdown={countdown} message={retryMessage} />;
  }

  if (error) {
    const errorText = errorPrefix ? `${errorPrefix}: ${error}` : error;
    return (
      <div className="alert alert-danger mx-3 mt-3 mb-3" role="alert">
        {errorText}
        {typeof onRetry === 'function' ? (
          <div className="mt-2">
            <button type="button" className="btn btn-sm btn-outline-danger mb-0" onClick={onRetry}>
              Retry now
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const hidePagination = !showPagination || !pagination?.total;

  return (
    <div className={`list-data-table mx-3 mb-3 ${className}`.trim()}>
      <div className="list-data-table-scroll">{children}</div>
      <TablePagination
        className="list-table-toolbar--footer"
        selectId={selectId}
        pagination={pagination}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
        hidden={hidePagination}
      />
    </div>
  );
};

export default ListDataTable;
