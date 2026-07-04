import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createTransaction } from '../../features/transactions/transactionsSlice.js';
import TransactionForm from '../../components/transactions/TransactionForm.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';
import { DEBUG } from '../../config/env.js';

const TransactionAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) navigate('/transactions', { replace: true });
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      await dispatch(createTransaction(values)).unwrap();
      toast.success('Transaction created successfully.');
      setTimeout(() => navigate('/transactions'), 700);
    } catch (error) {
      const message =
        typeof error === 'string' ? error : error?.message || 'Could not create transaction.';
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
                  <h5 className="mb-0">Add transaction</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      Saves via <code className="text-xs">POST /transaction/create</code>
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
              <TransactionForm
                submitting={submitting}
                submitLabel="Save transaction"
                onSubmit={handleSubmit}
                onCancel={() => navigate('/transactions')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionAdd;
