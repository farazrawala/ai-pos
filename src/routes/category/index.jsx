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
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
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

const statusBadgeClass = (active) =>
  active ? 'bg-gradient-success' : 'bg-gradient-secondary';

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

  // Handle sort change (double-click clears sort)
  const handleSort = (column, isDoubleClick = false) => {
    if (isDoubleClick) {
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    dispatch(setSort({ sortBy: column }));
  };

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh column={column} label={label} sort={sort} onSort={handleSort} className={className} />
  );

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
    };
  }, []);

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
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-4 col-md-5">
                  <h5 className="mb-1">Categories</h5>
                  {DEBUG ? (
                    <p className="text-sm text-muted mb-0">Server-side pagination and search.</p>
                  ) : null}
                </div>
                <div className="col-lg-8 col-md-7">
                  <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group input-group-sm" style={{ maxWidth: '260px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search categories…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search categories"
                      />
                    </div>
                    {canCreate ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-0"
                          onClick={() => setFetchCategoriesModalOpen(true)}
                        >
                          <i className="fas fa-cloud-download-alt me-1" aria-hidden="true" />
                          Fetch
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-0"
                          onClick={() => setSyncCategoriesModalOpen(true)}
                        >
                          <NavIcon icon={FaCloudArrowUp} className="me-1" size={14} />
                          Sync
                        </button>
                        <AddNewButton to="/categories/add" label="Add category" size="sm" />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className="list-data-table--categories"
                loading={loading}
                loadingLabel="Loading categories…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="categories-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th className="text-center list-col-sno">#</th>
                        <th className="list-col-product-img">Image</th>
                        {sortableTh('name', 'Name', 'list-col-truncate')}
                        <th className="list-col-truncate-sm">Parent</th>
                        {sortableTh('slug', 'Slug', 'list-col-truncate-sm')}
                        {sortableTh('status', 'Status')}
                        {sortableTh('createdAt', 'Created', 'list-col-date')}
                        <th className="text-end list-col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-5 text-muted">
                            No categories found. Try adjusting your search.
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const categoryId = categoryIdFromRecord(item);
                          const imageSrc = categoryImageSrc(item);
                          const displayName = item.name || item.category_name || 'Category';
                          const parentName = parentCategoryName(item);
                          const slug = item.slug || '—';
                          const active = isCategoryActive(item);
                          const isToggling = togglingCategoryId === categoryId;
                          const created = item.createdAt ?? item.created_at;
                          const updated = item.updatedAt ?? item.updated_at;
                          return (
                            <tr key={categoryId || index}>
                              <td className="text-center text-muted text-sm">{seriesNumber}</td>
                              <td>
                                {imageSrc ? (
                                  <img
                                    src={imageSrc}
                                    alt={displayName}
                                    className="list-product-thumb"
                                  />
                                ) : (
                                  <div className="list-product-thumb list-product-thumb--empty">
                                    <i className="fas fa-image text-muted" aria-hidden="true" />
                                  </div>
                                )}
                              </td>
                              <td
                                className="text-sm font-weight-bold text-dark list-cell-truncate"
                                title={displayName}
                              >
                                {displayName}
                              </td>
                              <td
                                className="text-sm list-cell-truncate-sm"
                                title={parentName !== '-' ? parentName : undefined}
                              >
                                {parentName === '-' ? '—' : parentName}
                              </td>
                              <td
                                className="text-sm list-cell-truncate-sm text-muted"
                                title={slug !== '—' ? slug : undefined}
                              >
                                {slug}
                              </td>
                              <td className="text-sm">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <span className={`badge text-xxs ${statusBadgeClass(active)}`}>
                                    {active ? 'Active' : 'Inactive'}
                                  </span>
                                  {canEdit ? (
                                    <div className="form-check form-switch mb-0 list-status-switch">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        role="switch"
                                        id={`toggle-${categoryId || index}`}
                                        checked={active}
                                        onChange={() => handleToggleStatus(categoryId, active)}
                                        disabled={isToggling}
                                        aria-label={`Toggle ${displayName} status`}
                                      />
                                      {isToggling ? (
                                        <span
                                          className="spinner-border spinner-border-sm text-primary ms-1"
                                          role="status"
                                          aria-hidden="true"
                                        />
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                              <td
                                className="text-sm text-nowrap list-col-date"
                                title={
                                  updated
                                    ? `Updated ${moment(updated).format('DD MMM YYYY h:mm a')}`
                                    : undefined
                                }
                              >
                                {created ? moment(created).format('DD MMM YYYY h:mm a') : '—'}
                              </td>
                              <td className="text-end">
                                <div className="list-table-actions">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary mb-0 px-2"
                                    title="View sync"
                                    aria-label="View sync"
                                    onClick={() =>
                                      setViewSyncCategory({ id: categoryId, name: displayName })
                                    }
                                  >
                                    <NavIcon icon={FaArrowsRotate} size={14} />
                                  </button>
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary mb-0"
                                      onClick={() => navigate(`/categories/edit/${categoryId}`)}
                                    >
                                      Edit
                                    </button>
                                  ) : null}
                                  {canDelete ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger mb-0"
                                      onClick={() => handleDelete(categoryId, displayName)}
                                      disabled={deleteStatus === 'loading'}
                                    >
                                      {deleteStatus === 'loading' ? 'Deleting…' : 'Delete'}
                                    </button>
                                  ) : null}
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
