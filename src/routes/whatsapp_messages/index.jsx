import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  fetchWhatsappMessages,
  deleteWhatsappMessage,
  clearDeleteStatus,
  setLimit,
  setPage,
  setSearch,
  setSort,
  setStatusFilter,
} from '../../features/whatsappMessages/whatsappMessagesSlice.js';
import { selectCompanyId } from '../../features/user/userSlice.js';
import { formatDisplayApiUrl } from '../../config/apiConfig.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { toast } from '../../utils/toast.js';

const formatStatus = (value) =>
  String(value || 'unknown')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusClass = (value) => {
  const status = String(value || '').toLowerCase();
  if (['sent', 'completed', 'success'].includes(status)) return 'bg-success';
  if (['failed', 'error'].includes(status)) return 'bg-danger';
  if (['processing', 'in_progress', 'started'].includes(status)) return 'bg-primary';
  if (['not_started', 'pending', 'queued'].includes(status)) return 'bg-warning text-dark';
  return 'bg-secondary';
};

const messagePreview = (value) => {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '—';
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

const messageIdFromRecord = (item) => String(item?._id || item?.id || '').trim();

const canStopSending = (item) => {
  if (!item || item.deletedAt) return false;
  const status = String(item.status || '').toLowerCase();
  return ['not_started', 'pending', 'queued', 'processing', 'in_progress', 'started'].includes(
    status
  );
};

const WhatsappMessages = () => {
  const dispatch = useDispatch();
  const { list, status, error, deleteStatus, pagination, search, statusFilter, sort } =
    useSelector((state) => state.whatsappMessages);
  const { canDelete } = usePermissions('whatsapp-messages');
  useRequireModuleAccess('whatsapp-messages');
  const companyId = useSelector(selectCompanyId);

  const fetchRandomUrl = useMemo(() => {
    const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
    return formatDisplayApiUrl(`whatsapp_message/fetch-random${query}`);
  }, [companyId]);

  const markSentUrl = useMemo(() => {
    const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
    return formatDisplayApiUrl(`whatsapp_message/mark-sent/:id${query}`);
  }, [companyId]);

  const markNotAvailableUrl = useMemo(() => {
    const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
    return formatDisplayApiUrl(`whatsapp_message/mark-not-available/:id${query}`);
  }, [companyId]);

  const [localSearch, setLocalSearch] = useState(search || '');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [stoppingId, setStoppingId] = useState('');
  const searchTimeoutRef = useRef(null);

  const loadMessages = useCallback(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    dispatch(fetchWhatsappMessages(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    search,
    statusFilter,
    sort.sortBy,
    sort.sortOrder,
  ]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    setLocalSearch(search || '');
  }, [search]);

  useEffect(
    () => () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    },
    []
  );

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setLocalSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => dispatch(setSearch(value)), 500);
  };

  const handleSort = (column, isDoubleClick = false) => {
    dispatch(setSort({ sortBy: isDoubleClick ? null : column }));
  };

  const handleStopSending = async (item) => {
    const id = messageIdFromRecord(item);
    if (!id) return;

    const number = item.number || 'this number';
    if (
      !window.confirm(
        `Stop sending this WhatsApp message to ${number}? It will be removed from the queue.`
      )
    ) {
      return;
    }

    setStoppingId(id);
    try {
      const result = await dispatch(deleteWhatsappMessage(id)).unwrap();
      const message =
        result?.response?.message || 'WhatsApp message stopped successfully.';
      toast.success(message);
      if (selectedMessage && messageIdFromRecord(selectedMessage) === id) {
        setSelectedMessage(null);
      }
      dispatch(clearDeleteStatus());
    } catch (err) {
      toast.error(err?.message || err || 'Failed to stop WhatsApp message');
    } finally {
      setStoppingId('');
    }
  };

  const showActionsColumn = canDelete;

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="row align-items-center gy-2">
                <div className="col-md-5">
                  <h5 className="mb-0">WhatsApp Messages</h5>
                  <p className="text-sm text-muted mb-0">Queued and delivered WhatsApp messages.</p>
                  <div className="mt-2 p-2 bg-gray-100 border-radius-md">
                    <span className="text-xs text-uppercase text-muted d-block mb-1">
                      API endpoints
                    </span>
                    <code className="text-xs text-break d-block user-select-all mb-1">
                      GET {fetchRandomUrl}
                    </code>
                    <code className="text-xs text-break d-block user-select-all mb-1">
                      GET {markSentUrl}
                    </code>
                    <code className="text-xs text-break d-block user-select-all">
                      GET {markNotAvailableUrl}
                    </code>
                    {companyId ? (
                      <span className="text-xs text-muted d-block mt-1">
                        Company ID: <code>{companyId}</code>
                      </span>
                    ) : (
                      <span className="text-xs text-warning d-block mt-1">
                        Company ID not found in session.
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-md-7">
                  <div className="d-flex justify-content-md-end gap-2 flex-wrap">
                    <select
                      className="form-select form-select-sm"
                      style={{ maxWidth: '180px' }}
                      value={statusFilter}
                      onChange={(event) => dispatch(setStatusFilter(event.target.value))}
                      aria-label="Filter by status"
                    >
                      <option value="">All statuses</option>
                      <option value="not_started">Not started</option>
                      <option value="processing">Processing</option>
                      <option value="sent">Sent</option>
                      <option value="failed">Failed</option>
                    </select>
                    <div className="input-group input-group-sm" style={{ maxWidth: '320px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search number or message…"
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={status === 'loading'}
                loadingLabel="Loading WhatsApp messages…"
                error={error}
                errorPrefix="Error loading WhatsApp messages"
                onRetry={loadMessages}
                pagination={pagination}
                onPageChange={(page) => dispatch(setPage(page))}
                onLimitChange={(limit) => dispatch(setLimit(limit))}
                selectId="whatsapp-messages-page-size"
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <ListSortableTh
                        column="number"
                        label="Number"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <th>Message</th>
                      <ListSortableTh
                        column="status"
                        label="Status"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <ListSortableTh
                        column="createdAt"
                        label="Created At"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <th>Updated At</th>
                      {showActionsColumn ? <th>Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 ? (
                      <tr>
                        <td colSpan={showActionsColumn ? 7 : 6} className="text-center text-sm p-4">
                          No WhatsApp messages found
                        </td>
                      </tr>
                    ) : (
                      list.map((item, index) => {
                        const id = messageIdFromRecord(item) || index;
                        const isStopping = stoppingId === id;
                        const stopAllowed = canDelete && canStopSending(item);
                        return (
                          <tr key={id}>
                            <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                            <td className="text-sm">{item.number || '—'}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-link btn-sm text-start text-dark p-0 mb-0"
                                title="View full message"
                                onClick={() => setSelectedMessage(item)}
                              >
                                {messagePreview(item.message)}
                              </button>
                            </td>
                            <td>
                              <span className={`badge ${statusClass(item.status)}`}>
                                {formatStatus(item.status)}
                              </span>
                            </td>
                            <td className="text-sm">
                              {item.createdAt
                                ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                : '—'}
                            </td>
                            <td className="text-sm">
                              {item.updatedAt
                                ? moment(item.updatedAt).format('MM-DD-YYYY h:mm a')
                                : '—'}
                            </td>
                            {showActionsColumn ? (
                              <td>
                                {stopAllowed ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger mb-0"
                                    onClick={() => handleStopSending(item)}
                                    disabled={isStopping || deleteStatus === 'loading'}
                                    title="Cancel queued message"
                                  >
                                    {isStopping ? (
                                      <>
                                        <span
                                          className="spinner-border spinner-border-sm me-1"
                                          role="status"
                                          aria-hidden="true"
                                        />
                                        Stopping…
                                      </>
                                    ) : (
                                      'Stop sending'
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-muted text-sm">—</span>
                                )}
                              </td>
                            ) : null}
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

      {selectedMessage ? (
        <>
          <div
            className="modal fade show"
            style={{ display: 'block' }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsappMessageDetailsTitle"
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title" id="whatsappMessageDetailsTitle">
                      WhatsApp Message
                    </h5>
                    <span className="text-sm text-muted">{selectedMessage.number || '—'}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setSelectedMessage(null)}
                  />
                </div>
                <div className="modal-body">
                  <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {selectedMessage.message || 'No message content.'}
                  </div>
                </div>
                <div className="modal-footer">
                  {canDelete && selectedMessage && canStopSending(selectedMessage) ? (
                    <button
                      type="button"
                      className="btn btn-outline-danger mb-0 me-auto"
                      onClick={() => handleStopSending(selectedMessage)}
                      disabled={
                        stoppingId === messageIdFromRecord(selectedMessage) ||
                        deleteStatus === 'loading'
                      }
                    >
                      {stoppingId === messageIdFromRecord(selectedMessage)
                        ? 'Stopping…'
                        : 'Stop sending'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-secondary mb-0"
                    onClick={() => setSelectedMessage(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            onClick={() => setSelectedMessage(null)}
            aria-hidden="true"
          />
        </>
      ) : null}
    </div>
  );
};

export default WhatsappMessages;
