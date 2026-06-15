import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FaArrowsRotate } from 'react-icons/fa6';
import {
  fetchCategories,
  deleteCategory,
  updateCategory,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/categories/categoriesSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import FetchCategoriesModal from '../../components/category/FetchCategoriesModal.jsx';
import SyncCategoriesModal from '../../components/category/SyncCategoriesModal.jsx';
import ViewCategorySyncModal from '../../components/category/ViewCategorySyncModal.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { FaCloudArrowUp } from 'react-icons/fa6';
import { DEBUG } from '../../config/env.js';

const categoryIdFromRecord = (item) => item?._id || item?.id || item?.category_id || '';

const categoryImageSrc = (cat) => {
  if (!cat) return '';
  const raw = cat.image ?? cat.category_image ?? cat.categoryImage ?? '';
  return resolveCategoryMediaUrl(raw);
};

const parentCategoryName = (item) => {
  const parent = item?.parent_id;
  if (!parent) return '-';
  if (typeof parent === 'object') {
    return parent.name || parent.category_name || '-';
  }
  return String(parent);
};

const isCategoryActive = (item) => {
  const status = String(item?.status || '').toLowerCase();
  if (status === 'active') return true;
  if (status === 'inactive') return false;
  return Boolean(item?.isActive);
};

const buildCategoryListParams = (pagination, searchTerm, sort) => {
  const params = {
    page: pagination.page,
    limit: pagination.limit,
    populate: 'parent_id',
  };
  if (searchTerm) params.search = searchTerm;
  if (sort.sortBy) {
    params.sortBy = sort.sortBy;
    params.sortOrder = sort.sortOrder;
  }
  return params;
};

const Category = () => {
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
  } = useSelector((state) => state.categories);
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const [togglingCategoryId, setTogglingCategoryId] = useState(null);
  const [fetchCategoriesModalOpen, setFetchCategoriesModalOpen] = useState(false);
  const [syncCategoriesModalOpen, setSyncCategoriesModalOpen] = useState(false);
  const [viewSyncCategory, setViewSyncCategory] = useState(null);

  // Get category permissions
  const { canView, canCreate, canEdit, canDelete } = usePermissions('categories');
  useRequireModuleAccess('categories');

  // useEffect(() => {
  //   console.log('canCreate', canCreate);
  //   console.log('canEdit', canEdit);
  //   console.log('canDelete', canDelete);
  //   console.log('canView', canView);
  // }, [canCreate]);
  // Fetch data from API using Redux with pagination, search, and sort
  useEffect(() => {
    dispatch(fetchCategories(buildCategoryListParams(pagination, searchTerm, sort)));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  // Handle search input with debounce
  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalSearch(value);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(() => {
        dispatch(setSearch(value));
      }, 500); // 500ms debounce
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
  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

  // Handle sort change with double-click detection
  const sortClickTimeoutRef = useRef(null);

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      // Clear the single click timeout if double-clicked
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
        sortClickTimeoutRef.current = null;
      }
      // Clear sorting on double click
      dispatch(setSort({ sortBy: null, sortOrder: null }));
    } else {
      // Delay single click to allow for double-click detection
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
      }
      sortClickTimeoutRef.current = setTimeout(() => {
        // Toggle sort on single click
        dispatch(setSort({ sortBy }));
        sortClickTimeoutRef.current = null;
      }, 200); // 200ms delay to detect double-click
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
  const handleToggleStatus = async (categoryId, isCurrentlyActive) => {
    const newStatus = isCurrentlyActive ? 'inactive' : 'active';
    setTogglingCategoryId(categoryId);

    try {
      await dispatch(
        updateCategory({
          categoryId,
          categoryData: { status: newStatus },
        })
      ).unwrap();

      dispatch(fetchCategories(buildCategoryListParams(pagination, searchTerm, sort)));
    } catch (error) {
      console.error('[Category module] Failed to toggle category status', { categoryId, error });
      // Show error toast
      const toastElement = document.getElementById('dangerToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }
        const toastBody = toastElement.querySelector('.toast-body');
        if (toastBody) {
          toastBody.textContent = error?.message || 'Failed to update category status';
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
      setTogglingCategoryId(null);
    }
  };

  // Handle delete category
  const handleDelete = async (categoryId, categoryName) => {
    const categoryNameDisplay = categoryName || 'this category';
    if (
      window.confirm(
        `Are you sure you want to delete "${categoryNameDisplay}"? This action cannot be undone.`
      )
    ) {
      try {
        await dispatch(deleteCategory(categoryId)).unwrap();
        // Optionally refresh the list to get updated data from server
        // Or the reducer already removes it from the list
        dispatch(fetchCategories(buildCategoryListParams(pagination, searchTerm, sort)));
      } catch (error) {
        // Error is handled by Redux state
        console.error('Delete error:', error);
      }
    }
  };

  useEffect(() => {
    if (error) {
      console.error('[Category module] Failed to fetch category list', error);
    }
  }, [error]);

  // Sync local search with Redux search term
  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  // Show toast notifications for delete status
  useEffect(() => {
    if (deleteStatus === 'succeeded') {
      const toastElement = document.getElementById('successToast');
      if (toastElement) {
        // Update time in toast
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        // Use Bootstrap Toast API if available
        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          // Fallback: manually show toast
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }

        // Clear status after toast is shown
        setTimeout(() => {
          dispatch(clearDeleteStatus());
        }, 5500);
      }
    }
  }, [deleteStatus, dispatch]);

  useEffect(() => {
    if (deleteError) {
      console.error('[Category module] Delete category error (Redux)', deleteError);
      const toastElement = document.getElementById('dangerToast');
      if (toastElement) {
        // Update time in toast
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        // Use Bootstrap Toast API if available
        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          // Fallback: manually show toast
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

  const showToast = (elementId, bodyText) => {
    const toastElement = document.getElementById(elementId);
    if (!toastElement) return;

    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) {
      timeElement.textContent = moment().format('h:mm A');
    }

    if (bodyText) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = bodyText;
    }

    if (window.bootstrap && window.bootstrap.Toast) {
      const toast = new window.bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
      toast.show();
    } else {
      toastElement.classList.remove('hide');
      toastElement.classList.add('show');
      setTimeout(() => {
        toastElement.classList.remove('show');
        toastElement.classList.add('hide');
      }, 5000);
    }
  };

  const refreshCategoryList = () => {
    dispatch(fetchCategories(buildCategoryListParams(pagination, searchTerm, sort)));
  };

  const handleFetchCategoriesSaved = () => {
    showToast('successToast', 'Category fetch process queued successfully!');
    refreshCategoryList();
  };

  const handleSyncCategoriesSaved = () => {
    showToast('successToast', 'Category sync processes queued successfully!');
    refreshCategoryList();
  };

  // Reusable Pagination Component

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center w-100">
                <div className="col-md-6">
                  <h5 className="mb-0">
                    {firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)}
                  </h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0">Server-side pagination and search enabled.</p>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search categories..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    {canCreate && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-md mb-0 text-sm"
                          onClick={() => setFetchCategoriesModalOpen(true)}
                        >
                          <i className="fas fa-cloud-download-alt me-1" />
                          Fetch Categories
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-md mb-0 text-sm"
                          onClick={() => setSyncCategoriesModalOpen(true)}
                        >
                          <NavIcon icon={FaCloudArrowUp} className="me-1" size={14} />
                          Sync Categories
                        </button>
                        <AddNewButton to="/categories/add" label="Add New Category" size="md" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading categories…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="categories-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0" id="datatable-search">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th className="text-center" style={{ width: '72px' }}>
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
                        <th>Parent Category</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('slug')}
                          onDoubleClick={() => handleSort('slug', true)}
                        >
                          Slug
                          {renderSortIcon('slug')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('status')}
                          onDoubleClick={() => handleSort('status', true)}
                        >
                          Status
                          {renderSortIcon('status')}
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
                            No categories found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          // Calculate series number accounting for pagination
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const imageSrc = categoryImageSrc(item);
                          const displayName = item.name || item.category_name || 'Category';
                          return (
                            <tr key={item._id || index}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal align-middle text-center">
                                {imageSrc ? (
                                  <img
                                    src={imageSrc}
                                    alt={displayName}
                                    className="rounded border"
                                    style={{
                                      width: '40px',
                                      height: '40px',
                                      objectFit: 'cover',
                                      verticalAlign: 'middle',
                                    }}
                                  />
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.name || item.category_name || '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {parentCategoryName(item)}
                              </td>
                              <td className="text-sm font-weight-normal">{item.slug || '-'}</td>
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex align-items-center gap-2">
                                  <div className="form-check form-switch mb-0">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      role="switch"
                                      id={`toggle-${item._id || item.id || item.category_id || index}`}
                                      checked={isCategoryActive(item)}
                                      onChange={() =>
                                        handleToggleStatus(
                                          item._id || item.id || item.category_id,
                                          isCategoryActive(item)
                                        )
                                      }
                                      disabled={
                                        togglingCategoryId ===
                                        (item._id || item.id || item.category_id)
                                      }
                                      style={{
                                        width: '2.5rem',
                                        height: '1.25rem',
                                        cursor:
                                          togglingCategoryId ===
                                          (item._id || item.id || item.category_id)
                                            ? 'not-allowed'
                                            : 'pointer',
                                      }}
                                    />
                                  </div>

                                  {togglingCategoryId ===
                                  (item._id || item.id || item.category_id) ? (
                                    <span
                                      className="spinner-border spinner-border-sm text-primary"
                                      role="status"
                                      style={{ width: '1rem', height: '1rem' }}
                                    >
                                      <span className="visually-hidden">Loading...</span>
                                    </span>
                                  ) : (
                                    <span
                                      className={`badge ${isCategoryActive(item) ? 'bg-success' : 'bg-secondary'}`}
                                    >
                                      {isCategoryActive(item) ? 'Active' : 'Inactive'}
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
                                {moment(item.updatedAt).fromNow()}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-info mb-0 px-2 py-1"
                                    title="View Sync"
                                    aria-label="View Sync"
                                    onClick={() =>
                                      setViewSyncCategory({
                                        id: categoryIdFromRecord(item),
                                        name: item.name || item.category_name || 'Category',
                                      })
                                    }
                                  >
                                    <NavIcon icon={FaArrowsRotate} size={14} />
                                  </button>
                                  {canEdit && (
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={() =>
                                        navigate(
                                          `/categories/edit/${item._id || item.id || item.category_id}`
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
                                          item._id || item.id || item.category_id,
                                          item.name || item.category_name
                                        )
                                      }
                                      disabled={deleteStatus === 'loading'}
                                    >
                                      {deleteStatus === 'loading' ? 'Deleting...' : 'Delete'}
                                    </button>
                                  )}
                                  {!canEdit && !canDelete && (
                                    <span className="text-muted text-sm">No edit/delete access</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
              </ListDataTable>
            </div>
          </div>
        </div>
      </div>

      <FetchCategoriesModal
        open={fetchCategoriesModalOpen}
        onClose={() => setFetchCategoriesModalOpen(false)}
        onSaved={handleFetchCategoriesSaved}
      />

      <SyncCategoriesModal
        open={syncCategoriesModalOpen}
        onClose={() => setSyncCategoriesModalOpen(false)}
        onSaved={handleSyncCategoriesSaved}
      />

      <ViewCategorySyncModal
        open={Boolean(viewSyncCategory?.id)}
        categoryId={viewSyncCategory?.id || ''}
        categoryName={viewSyncCategory?.name || ''}
        onClose={() => setViewSyncCategory(null)}
      />

      {/* Toast Notifications */}
      <div className="position-fixed bottom-1 end-1 z-index-2">
        {/* Success Toast */}
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
          <div className="toast-body">Category deleted successfully!</div>
        </div>

        {/* Danger Toast */}
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
            {deleteError || 'An error occurred while deleting the category.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Category;
