import TablePagination from '../TablePagination.jsx';

/**
 * Standard list page table shell: horizontal scroll, styled table, footer pagination.
 */
const ListDataTable = ({
  loading = false,
  loadingLabel = 'Loading…',
  error = null,
  errorPrefix = 'Error loading data',
  pagination,
  onPageChange,
  onLimitChange,
  selectId = 'table-page-size',
  showPagination = true,
  className = '',
  children,
}) => {
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

  if (error) {
    return (
      <div className="alert alert-danger mx-3 mt-3 mb-3" role="alert">
        {errorPrefix}: {error}
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
