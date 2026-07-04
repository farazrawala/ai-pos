import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  updateTransaction,
  fetchTransactionById,
} from '../../features/transactions/transactionsSlice.js';
import TransactionForm from '../../components/transactions/TransactionForm.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';
import { DEBUG } from '../../config/env.js';

/** Normalize a transaction record (populated account_id → id) into form initial values. */
const toInitialValues = (row) => {
  if (!row || typeof row !== 'object') return null;
  const acc = row.account_id;
  const accountId =
    acc && typeof acc === 'object' && !Array.isArray(acc)
      ? String(acc._id ?? acc.id ?? '')
      : String(acc ?? '');
  return {
    account_id: accountId,
    type: row.type ?? 'debit',
    amount: row.amount,
    description: row.description ?? '',
    status: row.status ?? 'active',
  };
};

const TransactionEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { isAdmin } = usePermissions();

  const [initialValues, setInitialValues] = useState(() =>
    location.state?.transaction ? toInitialValues(location.state.transaction) : null
  );
  const [loadStatus, setLoadStatus] = useState(location.state?.transaction ? 'succeeded' : 'idle');
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) navigate('/transactions', { replace: true });
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin || initialValues) return;
    let cancelled = false;
    setLoadStatus('loading');
    setLoadError(null);
    dispatch(fetchTransactionById(id))
      .unwrap()
      .then((row) => {
        if (cancelled) return;
        setInitialValues(toInitialValues(row));
        setLoadStatus('succeeded');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(typeof err === 'string' ? err : err?.message || 'Failed to load transaction');
        setLoadStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, id, isAdmin, initialValues]);

  if (!isAdmin) return null;

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      await dispatch(updateTransaction({ id, data: values })).unwrap();
      toast.success('Transaction updated successfully.');
      setTimeout(() => navigate('/transactions'), 700);
    } catch (error) {
      const message =
        typeof error === 'string' ? error : error?.message || 'Could not update transaction.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Edit transaction</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      Saves via <code className="text-xs">PATCH /transaction/update/{id}</code>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary mb-0"
                  onClick={() => navigate('/transactions')}
                >
                  Back to list
                </button>
              </div>
            </div>
            <div className="card-body">
              {loadStatus === 'loading' && (
                <p className="text-sm text-muted mb-0">Loading transaction…</p>
              )}
              {loadStatus === 'failed' && (
                <div className="alert alert-danger py-2 mb-0">{loadError}</div>
              )}
              {loadStatus === 'succeeded' && (
                <TransactionForm
                  initialValues={initialValues}
                  submitting={submitting}
                  submitLabel="Update transaction"
                  onSubmit={handleSubmit}
                  onCancel={() => navigate('/transactions')}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionEdit;
