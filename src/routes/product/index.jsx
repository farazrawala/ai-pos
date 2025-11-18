import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchProducts,
  deleteProduct,
  updateProduct,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/products/productsSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const Product = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
    deleteStatus,
    deleteError,
  } = useSelector((state) => state.products);
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const [togglingProductId, setTogglingProductId] = useState(null);

  // Get product permissions
  const { canView, canCreate, canEdit, canDelete } = usePermissions('product');

  // Redirect if user doesn't have view permission
  useEffect(() => {
    if (canView === false) {
      navigate('/dashboard');
    }
  }, [canView, navigate]);

  // Fetch data from API using Redux with pagination, search, and sort
  useEffect(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };

    if (searchTerm) {
      params.search = searchTerm;
    }

    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }

    dispatch(fetchProducts(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  // Handle search input with debounce
  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalSearch(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        dispatch(setSearch(value));
      }, 500);
    },
    [dispatch]
  );

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  // Handle limit change
  const handleLimitChange = (e) => {
    dispatch(setLimit(Number(e.target.value)));
  };

  // Handle sort change with double-click detection
  const sortClickTimeoutRef = useRef(null);

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
        sortClickTimeoutRef.current = null;
      }
      dispatch(setSort({ sortBy: null, sortOrder: null }));
    } else {
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
      }
      sortClickTimeoutRef.current = setTimeout(() => {
        dispatch(setSort({ sortBy }));
        sortClickTimeoutRef.current = null;
      }, 200);
    }
  };

  // Render sort icon
  const renderSortIcon = (columnName) => {
    if (sort.sortBy !== columnName) {
      return <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.75rem' }}></i>;
    }
    return sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    );
  };

  // Handle toggle status
  const handleToggleStatus = async (productId, currentStatus) => {
    const newStatus = !currentStatus;
    setTogglingProductId(productId);

    try {
      await dispatch(
        updateProduct({
          productId,
          productData: { isActive: newStatus },
          images: [],
        })
      ).unwrap();

      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (sort.sortBy) {
        params.sortBy = sort.sortBy;
        params.sortOrder = sort.sortOrder;
      }
      dispatch(fetchProducts(params));
    } catch (error) {
      console.error('Toggle status error:', error);
      const toastElement = document.getElementById('dangerToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }
        const toastBody = toastElement.querySelector('.toast-body');
        if (toastBody) {
          toastBody.textContent = error?.message || 'Failed to update product status';
        }
        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }
      }
    } finally {
      setTogglingProductId(null);
    }
  };

  // Handle delete product
  const handleDelete = async (productId, productName) => {
    const productNameDisplay = productName || 'this product';
    if (
      window.confirm(
        `Are you sure you want to delete "${productNameDisplay}"? This action cannot be undone.`
      )
    ) {
      try {
        await dispatch(deleteProduct(productId)).unwrap();
        const params = {
          page: pagination.page,
          limit: pagination.limit,
        };
        if (searchTerm) {
          params.search = searchTerm;
        }
        if (sort.sortBy) {
          params.sortBy = sort.sortBy;
          params.sortOrder = sort.sortOrder;
        }
        dispatch(fetchProducts(params));
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  // Sync local search with Redux search term
  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  // Show toast notifications for delete status
  useEffect(() => {
    if (deleteStatus === 'succeeded') {
      const toastElement = document.getElementById('successToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }

        setTimeout(() => {
          dispatch(clearDeleteStatus());
        }, 5500);
      }
    }
  }, [deleteStatus, dispatch]);

  useEffect(() => {
    if (deleteError) {
      const toastElement = document.getElementById('dangerToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }
      }
    }
  }, [deleteError]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
      }
    };
  }, []);

  const firstSegment = window.location.pathname.split('/')[1];

  // Calculate pagination info
  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  // Reusable Pagination Component
  const PaginationControls = () => {
    if (loading || error || pagination.total === 0) return null;

    return (
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center">
          <span className="text-sm text-muted me-2">Show:</span>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={pagination.limit}
            onChange={handleLimitChange}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span className="text-sm text-muted ms-2">
            Showing {startItem} to {endItem} of {pagination.total} entries
          </span>
        </div>

        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
              <button
                className="page-link"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
              >
                First
              </button>
            </li>
            <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
              <button
                className="page-link"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </button>
            </li>
            <li className="page-item active">
              <span className="page-link">
                Page {pagination.page} of {pagination.totalPages}
              </span>
            </li>
            <li
              className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}
            >
              <button
                className="page-link"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
              </button>
            </li>
            <li
              className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}
            >
              <button
                className="page-link"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Last
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">
                    {firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)}
                  </h5>
                  <p className="text-sm mb-0">Server-side pagination and search enabled.</p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-end align-items-center gap-2">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search products..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    {canCreate && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate('/products/add')}
                      >
                        <i className="fas fa-plus me-1"></i>
                        Add New Product
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              <PaginationControls />

              <div className="table-responsive">
                {loading && (
                  <div className="text-center p-4">
                    <p>Loading products...</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    Error loading data: {error}
                  </div>
                )}
                {!loading && !error && (
                  <table className="table table-flush" id="datatable-search">
                    <thead className="thead-light">
                      <tr>
                        <th>S.No</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                          onDoubleClick={() => handleSort('name', true)}
                        >
                          Image
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                          onDoubleClick={() => handleSort('name', true)}
                        >
                          Name
                          {renderSortIcon('name')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('price')}
                          onDoubleClick={() => handleSort('price', true)}
                        >
                          Price
                          {renderSortIcon('price')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('stock')}
                          onDoubleClick={() => handleSort('stock', true)}
                        >
                          Stock
                          {renderSortIcon('stock')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('isActive')}
                          onDoubleClick={() => handleSort('isActive', true)}
                        >
                          Status
                          {renderSortIcon('isActive')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('createdAt')}
                          onDoubleClick={() => handleSort('createdAt', true)}
                        >
                          Created At
                          {renderSortIcon('createdAt')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('updatedAt')}
                          onDoubleClick={() => handleSort('updatedAt', true)}
                        >
                          Last Updated At
                          {renderSortIcon('updatedAt')}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center text-sm font-weight-normal p-4">
                            No products found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const mainImage =
                            item.product_image ||
                            (item.multi_images && item.multi_images.length > 0
                              ? item.multi_images[0]
                              : null) ||
                            (item.images && item.images.length > 0 ? item.images[0] : null) ||
                            item.image ||
                            null;
                          return (
                            <tr key={item._id || index}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">
                                {mainImage ? (
                                  <img
                                    src={mainImage}
                                    alt={item.product_name || 'Product'}
                                    style={{
                                      width: '50px',
                                      height: '50px',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                    }}
                                    onError={(e) => {
                                      e.target.src = '/assets/img/default.jpg';
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '50px',
                                      height: '50px',
                                      backgroundColor: '#f0f0f0',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <i className="fas fa-image text-muted"></i>
                                  </div>
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.name || item.product_name || '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.price || item.product_price
                                  ? `$${parseFloat(item.price || item.product_price || 0).toFixed(2)}`
                                  : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.stock !== undefined ? item.stock : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex align-items-center gap-2">
                                  <div className="form-check form-switch mb-0">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      role="switch"
                                      id={`toggle-${item._id || item.id || item.product_id || index}`}
                                      checked={
                                        item.isActive ||
                                        item.status === 'active' ||
                                        item.status === 1
                                      }
                                      onChange={() =>
                                        handleToggleStatus(
                                          item._id || item.id || item.product_id,
                                          item.isActive ||
                                            item.status === 'active' ||
                                            item.status === 1
                                        )
                                      }
                                      disabled={
                                        togglingProductId ===
                                        (item._id || item.id || item.product_id)
                                      }
                                      style={{
                                        width: '2.5rem',
                                        height: '1.25rem',
                                        cursor:
                                          togglingProductId ===
                                          (item._id || item.id || item.product_id)
                                            ? 'not-allowed'
                                            : 'pointer',
                                      }}
                                    />
                                  </div>
                                  {togglingProductId ===
                                  (item._id || item.id || item.product_id) ? (
                                    <span
                                      className="spinner-border spinner-border-sm text-primary"
                                      role="status"
                                      style={{ width: '1rem', height: '1rem' }}
                                    >
                                      <span className="visually-hidden">Loading...</span>
                                    </span>
                                  ) : (
                                    <span
                                      className={`badge ${item.isActive || item.status === 'active' || item.status === 1 ? 'bg-success' : 'bg-secondary'}`}
                                    >
                                      {item.isActive ||
                                      item.status === 'active' ||
                                      item.status === 1
                                        ? 'Active'
                                        : 'Inactive'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.updatedAt ? moment(item.updatedAt).fromNow() : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex gap-1">
                                  {canEdit && (
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={() =>
                                        navigate(
                                          `/products/edit/${item._id || item.id || item.product_id}`
                                        )
                                      }
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      className="btn btn-sm btn-danger"
                                      onClick={() =>
                                        handleDelete(
                                          item._id || item.id || item.product_id,
                                          item.name || item.product_name || 'Product'
                                        )
                                      }
                                      disabled={deleteStatus === 'loading'}
                                    >
                                      {deleteStatus === 'loading' ? 'Deleting...' : 'Delete'}
                                    </button>
                                  )}
                                  {!canEdit && !canDelete && (
                                    <span className="text-muted text-sm">No actions available</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              <PaginationControls />
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="position-fixed bottom-1 end-1 z-index-2">
        <div
          className="toast fade hide p-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="successToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Product deleted successfully!</div>
        </div>

        <div
          className="toast fade hide p-2 mt-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="dangerToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-notification-70 text-danger me-2"></i>
            <span className="me-auto text-gradient text-danger font-weight-bold">Error</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">
            {deleteError || 'An error occurred while deleting the product.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Product;
