import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../../features/categories/categoriesSlice.js';
// import { useParams } from 'react-router-dom';

const Category = () => {
  const dispatch = useDispatch();
  const { list: data, status, error } = useSelector((state) => state.categories);
  const loading = status === 'loading';

  // Fetch data from API using Redux
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Initialize DataTables after data is loaded
  useEffect(() => {
    if (status === 'loading' || status === 'idle') return;

    let dataTableSearch = null;

    const initDataTables = () => {
      // Check if the library is loaded
      if (typeof window.simpleDatatables === 'undefined') {
        console.warn('simpleDatatables library not loaded yet');
        return false;
      }

      // Check if table element exists
      const searchTable = document.getElementById('datatable-search');

      if (!searchTable) {
        console.warn('Table element not found');
        return false;
      }

      // Destroy existing DataTable if it exists
      if (searchTable.dataset.simpleDatatables) {
        try {
          const existingTable = window.simpleDatatables.DataTable.get('#datatable-search');
          if (existingTable) {
            existingTable.destroy();
          }
        } catch (e) {
          // Ignore if destroy fails
        }
      }

      try {
        dataTableSearch = new window.simpleDatatables.DataTable('#datatable-search', {
          searchable: true,
          fixedHeight: true,
        });
        console.log('DataTable Search initialized successfully');
        return true;
      } catch (error) {
        console.error('DataTables initialization error:', error);
        return false;
      }
    };

    // Function to wait for library and initialize
    const waitAndInit = () => {
      let attempts = 0;
      const maxAttempts = 30; // Try for 3 seconds (30 * 100ms)

      const checkAndInit = () => {
        if (initDataTables()) {
          return; // Successfully initialized
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkAndInit, 100);
        } else {
          console.error(
            'Failed to initialize DataTables after multiple attempts. Make sure datatables.js is loaded.'
          );
        }
      };

      checkAndInit();
    };

    // Start initialization after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(waitAndInit, 200);

    // Cleanup function to destroy DataTables on unmount
    return () => {
      clearTimeout(timeoutId);
      if (dataTableSearch) {
        try {
          dataTableSearch.destroy();
        } catch (error) {
          console.error('Error destroying dataTableSearch:', error);
        }
      }
    };
  }, [data, status]);
  //   const { first_param } = useParams(); // first = "categories"
  const firstSegment = window.location.pathname.split('/')[1];

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header">
              <h5 className="mb-0">
                {firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)}
              </h5>
              <p className="text-sm mb-0">
                A lightweight, extendable, dependency-free javascript HTML table plugin.
              </p>
            </div>
            <div className="table-responsive">
              {loading && (
                <div className="text-center p-4">
                  <p>Loading categories...</p>
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
                      <th>ID</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-sm font-weight-normal p-4">
                          No categories found
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => (
                        <tr key={item.id || item.category_id || index}>
                          <td className="text-sm font-weight-normal">
                            {item.id || item.category_id || '-'}
                          </td>
                          <td className="text-sm font-weight-normal">
                            {item.name || item.category_name || '-'}
                          </td>
                          <td className="text-sm font-weight-normal">{item.description || '-'}</td>
                          <td className="text-sm font-weight-normal">
                            <span
                              className={`badge ${item.status === 'active' || item.status === 1 ? 'bg-success' : 'bg-secondary'}`}
                            >
                              {item.status || 'N/A'}
                            </span>
                          </td>
                          <td className="text-sm font-weight-normal">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="text-sm font-weight-normal">
                            <button className="btn btn-sm btn-primary me-1">Edit</button>
                            <button className="btn btn-sm btn-danger">Delete</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Category;
