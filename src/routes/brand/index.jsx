import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FaArrowsRotate, FaCloudArrowUp } from 'react-icons/fa6';
import {
  fetchBrands,
  deleteBrand,
  updateBrand,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/brands/brandsSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import FetchBrandsModal from '../../components/brand/FetchBrandsModal.jsx';
import SyncBrandsModal from '../../components/brand/SyncBrandsModal.jsx';
import ViewBrandSyncModal from '../../components/brand/ViewBrandSyncModal.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { DEBUG } from '../../config/env.js';

const brandIdFromRecord = (item) => item?._id || item?.id || item?.brand_id || '';

const parentBrandName = (item) => {
  const parent = item?.parent_id;
  if (!parent) return '-';
  if (typeof parent === 'object') {
    return parent.name || parent.brand_name || '-';
  }
  return String(parent);
};

const isBrandActive = (item) => {
  const status = String(item?.status || '').toLowerCase();
  if (status === 'active') return true;
  if (status === 'inactive') return false;
  return Boolean(item?.isActive);
};

const buildBrandListParams = (pagination, searchTerm, sort) => {
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

const Brand = () => {
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
  } = useSelector((state) => state.brands);
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);
  const [togglingBrandId, setTogglingBrandId] = useState(null);
  const [fetchBrandsModalOpen, setFetchBrandsModalOpen] = useState(false);
  const [syncBrandsModalOpen, setSyncBrandsModalOpen] = useState(false);
  const [viewSyncBrand, setViewSyncBrand] = useState(null);

  const { canCreate, canEdit, canDelete } = usePermissions('brands');
  useRequireModuleAccess('brands');

  useEffect(() => {
    dispatch(fetchBrands(buildBrandListParams(pagination, searchTerm, sort)));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalSearch(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        dispatch(setSearch(value));
      }, 500);
    },
    [dispatch]
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    sortClickTimeoutRef.current = setTimeout(() => dispatch(setSort({ sortBy })), 200);
  };

  const renderSortIcon = (columnName) =>
    sort.sortBy !== columnName ? (
      <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    );

  const handleToggleStatus = async (brandId, isCurrentlyActive) => {
    const newStatus = isCurrentlyActive ? 'inactive' : 'active';
    setTogglingBrandId(brandId);
    try {
      await dispatch(
        updateBrand({
          brandId,
          brandData: { status: newStatus },
        })
      ).unwrap();
      dispatch(fetchBrands(buildBrandListParams(pagination, searchTerm, sort)));
    } catch (err) {
      console.error('[Brand module] Failed to toggle brand status', { brandId, error: err });
    } finally {
      setTogglingBrandId(null);
    }
  };

  const handleDelete = async (brandId, brandName) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${brandName || 'this brand'}"? This action cannot be undone.`
      )
    ) {
      try {
        await dispatch(deleteBrand(brandId)).unwrap();
        dispatch(fetchBrands(buildBrandListParams(pagination, searchTerm, sort)));
      } catch (err) {
        console.error('[Brand module] Delete error:', err);
      }
    }
  };

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    if (deleteStatus === 'succeeded') {
      const toastElement = document.getElementById('successToast');
      if (toastElement && window.bootstrap?.Toast) {
        const toast = new window.bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
        toast.show();
      }
      setTimeout(() => dispatch(clearDeleteStatus()), 5500);
    }
  }, [deleteStatus, dispatch]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

  const firstSegment = window.location.pathname.split('/')[1];

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

  const refreshBrandList = () => {
    dispatch(fetchBrands(buildBrandListParams(pagination, searchTerm, sort)));
  };

  const handleFetchBrandsSaved = () => {
    showToast('successToast', 'Brand fetch process queued successfully!');
    refreshBrandList();
  };

  const handleSyncBrandsSaved = () => {
    showToast('successToast', 'Brand sync processes queued successfully!');
    refreshBrandList();
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header">
              <div className="row align-items-center w-100">
                <div className="col-lg-3">
                  <h5 className="mb-0">
                    {firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)}
                  </h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0">Server-side pagination and search enabled.</p>
                  ) : null}
                </div>
                <div className="col-lg-9">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search brands..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    {canCreate && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-md mb-0 text-sm"
                          onClick={() => setFetchBrandsModalOpen(true)}
                        >
                          <i className="fas fa-cloud-download-alt me-1" />
                          Fetch Brands
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-md mb-0 text-sm"
                          onClick={() => setSyncBrandsModalOpen(true)}
                        >
                          <NavIcon icon={FaCloudArrowUp} className="me-1" size={14} />
                          Sync Brands
                        </button>
                        <AddNewButton to="/brands/add" label="Add New Brand" size="md" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading brands…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="brands-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0" id="datatable-search">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('name')}
                        onDoubleClick={() => handleSort('name', true)}
                      >
                        Name
                        {renderSortIcon('name')}
                      </th>
                      <th>Parent Brand</th>
                      <th>Description</th>
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
                        <td colSpan="8" className="text-center text-sm font-weight-normal p-4">
                          No brands found
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const id = brandIdFromRecord(item);
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const displayName = item.name || item.brand_name || 'Brand';
                        return (
                          <tr key={id || index}>
                            <td className="text-sm font-weight-normal">{seriesNumber}</td>
                            <td className="text-sm font-weight-normal">{displayName}</td>
                            <td className="text-sm font-weight-normal">{parentBrandName(item)}</td>
                            <td className="text-sm font-weight-normal">
                              {item.description || '-'}
                            </td>
                            <td className="text-sm font-weight-normal">
                              <div className="d-flex align-items-center gap-2">
                                <div className="form-check form-switch mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id={`toggle-${id || index}`}
                                    checked={isBrandActive(item)}
                                    onChange={() =>
                                      handleToggleStatus(id, isBrandActive(item))
                                    }
                                    disabled={togglingBrandId === id}
                                    style={{
                                      width: '2.5rem',
                                      height: '1.25rem',
                                      cursor: togglingBrandId === id ? 'not-allowed' : 'pointer',
                                    }}
                                  />
                                </div>
                                {togglingBrandId === id ? (
                                  <span
                                    className="spinner-border spinner-border-sm text-primary"
                                    role="status"
                                    style={{ width: '1rem', height: '1rem' }}
                                  >
                                    <span className="visually-hidden">Loading...</span>
                                  </span>
                                ) : (
                                  <span
                                    className={`badge ${isBrandActive(item) ? 'bg-success' : 'bg-secondary'}`}
                                  >
                                    {isBrandActive(item) ? 'Active' : 'Inactive'}
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
                              <div className="d-flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-info mb-0 px-2 py-1"
                                  title="View Sync"
                                  aria-label="View Sync"
                                  onClick={() =>
                                    setViewSyncBrand({
                                      id: brandIdFromRecord(item),
                                      name: displayName,
                                    })
                                  }
                                >
                                  <NavIcon icon={FaArrowsRotate} size={14} />
                                </button>
                                {canEdit && (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => navigate(`/brands/edit/${id}`)}
                                  >
                                    Edit
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDelete(id, displayName)}
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

      <FetchBrandsModal
        open={fetchBrandsModalOpen}
        onClose={() => setFetchBrandsModalOpen(false)}
        onSaved={handleFetchBrandsSaved}
      />

      <SyncBrandsModal
        open={syncBrandsModalOpen}
        onClose={() => setSyncBrandsModalOpen(false)}
        onSaved={handleSyncBrandsSaved}
      />

      <ViewBrandSyncModal
        open={Boolean(viewSyncBrand?.id)}
        brandId={viewSyncBrand?.id || ''}
        brandName={viewSyncBrand?.name || ''}
        onClose={() => setViewSyncBrand(null)}
      />

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
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Brand deleted successfully!</div>
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
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">
            {deleteError || 'An error occurred while deleting the brand.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Brand;
