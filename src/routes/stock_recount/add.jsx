import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  fetchActiveWarehousesRequest,
  startRecountSessionRequest,
} from '../../features/stockRecount/stockRecountAPI.js';
import { getWarehouseIdFromCompany } from '../../features/company/companyAPI.js';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { DEBUG } from '../../config/env.js';
import { toast } from '../../utils/toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import './stock-recount.css';

const warehouseOptionId = (w) => String(w?._id || w?.id || '').trim();
const warehouseOptionName = (w) => w?.name || w?.warehouse_name || w?.code || 'Warehouse';

const StockRecountAdd = () => {
  useRequireModuleAccess('stock-recounts');
  const { canCreate, isAdmin } = usePermissions('stock-recounts');
  const navigate = useNavigate();
  const authCompany = useSelector((state) => state.user.company);
  const defaultWarehouseId = useMemo(
    () => getWarehouseIdFromCompany(authCompany),
    [authCompany]
  );

  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId || '');
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesStatus, setWarehousesStatus] = useState('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (defaultWarehouseId && !warehouseId) setWarehouseId(defaultWarehouseId);
  }, [defaultWarehouseId, warehouseId]);

  useEffect(() => {
    let cancelled = false;
    setWarehousesStatus('loading');
    (async () => {
      try {
        const rows = await fetchActiveWarehousesRequest({ limit: 1000 });
        if (cancelled) return;
        rows.sort((a, b) =>
          String(warehouseOptionName(a)).localeCompare(String(warehouseOptionName(b)), undefined, {
            sensitivity: 'base',
          })
        );
        setWarehouses(rows);
        setWarehousesStatus('succeeded');
      } catch (err) {
        if (cancelled) return;
        setWarehouses([]);
        setWarehousesStatus('failed');
        setFormError(err?.message || 'Failed to load warehouses');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const warehouseOptions = useMemo(
    () =>
      warehouses
        .map((w) => {
          const id = warehouseOptionId(w);
          if (!id) return null;
          return { value: id, label: warehouseOptionName(w) };
        })
        .filter(Boolean),
    [warehouses]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate && !isAdmin) {
      toast.error('You do not have permission to start a recount.');
      return;
    }
    const wid = String(warehouseId || '').trim();
    if (!wid) {
      setFormError('Select a warehouse');
      return;
    }
    setFormError('');
    setIsSubmitting(true);
    try {
      const result = await startRecountSessionRequest({ warehouseId: wid });
      toast.success(
        result.totalLines
          ? `Recount started with ${result.totalLines} products.`
          : 'Recount started.'
      );
      navigate(`/stock-recounts/${result.stockRecountId}`);
    } catch (err) {
      setFormError(err?.message || 'Could not start recount.');
      toast.error(err?.message || 'Could not start recount.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0 stock-recount-page">
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <button
            type="button"
            className="stock-recount-back"
            onClick={() => navigate('/stock-recounts')}
          >
            ← Back to recounts
          </button>
          <div className="card shadow-sm stock-recount-card">
            <div className="card-header pb-0">
              <h5 className="mb-1">Start stock recount</h5>
              <p className="text-sm text-muted mb-0">
                Snapshot current warehouse quantities, then enter physical counts.
              </p>
              {DEBUG ? (
                <p className="text-xs text-muted mt-2 mb-0">
                  <code>POST /stock_recount/start</code> {'{ warehouse_id }'} — server creates{' '}
                  <code>stock_recount_id</code> and <code>system_qty</code>
                </p>
              ) : null}
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="recount-warehouse">
                    Warehouse
                  </label>
                  <SearchableSelect
                    options={warehouseOptions}
                    value={warehouseId}
                    placeholder="Select warehouse"
                    disabled={isSubmitting || warehousesStatus === 'loading'}
                    onChange={(next) => {
                      setWarehouseId(next);
                      setFormError('');
                    }}
                  />
                  {warehousesStatus === 'loading' ? (
                    <p className="text-xs text-muted mb-0 mt-1">Loading warehouses…</p>
                  ) : null}
                </div>

                {formError ? (
                  <div className="alert alert-danger text-sm" role="alert">
                    {formError}
                  </div>
                ) : null}

                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary mb-0"
                    disabled={isSubmitting || !warehouseId || (!canCreate && !isAdmin)}
                  >
                    {isSubmitting ? 'Starting…' : 'Start recount'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary mb-0"
                    disabled={isSubmitting}
                    onClick={() => navigate('/stock-recounts')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockRecountAdd;
