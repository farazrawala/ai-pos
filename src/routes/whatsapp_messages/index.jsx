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
import {
  createWhatsappMessageRequest,
  resetUnknownUsageOnlyRequest,
} from '../../features/whatsappMessages/whatsappMessagesAPI.js';
import {
  fetchCompanyById,
  getCompanyFromApiBody,
} from '../../features/company/companyAPI.js';
import { selectCompany, selectCompanyId, setCompany } from '../../features/user/userSlice.js';
import { getCompanyWhatsappNumber } from '../../features/whatsappChat/whatsappChatAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import DevApiSourcesFooter from '../../components/common/DevApiSourcesFooter.jsx';
import { buildApiUrl } from '../../config/apiConfig.js';
import { DEBUG } from '../../config/env.js';
import { toast } from '../../utils/toast.js';
import '../../components/common/devApiSources.css';
import './whatsapp-messages-module.css';

const DEFAULT_UNKNOWN_WHATSAPP_SETTINGS = {
  daily_limit: 5,
  usage: 0,
  increase_daily: 1,
};

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'not_started', label: 'Not started' },
  { id: 'processing', label: 'Processing' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
  { id: 'not_available', label: 'Not available' },
];

const WHATSAPP_NUMBER_PREFIX = '92';
const WHATSAPP_NUMBER_MAX_LENGTH = 12;

/** Digits only, always starts with 92, max 12 characters. */
function normalizeWhatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith(WHATSAPP_NUMBER_PREFIX)) {
    return digits.slice(0, WHATSAPP_NUMBER_MAX_LENGTH);
  }
  if (!digits || WHATSAPP_NUMBER_PREFIX.startsWith(digits)) {
    return WHATSAPP_NUMBER_PREFIX;
  }
  return `${WHATSAPP_NUMBER_PREFIX}${digits.replace(/^0+/, '')}`.slice(
    0,
    WHATSAPP_NUMBER_MAX_LENGTH
  );
}

/** Read first `unknown_whatsapp_settings` entry from company (with schema defaults). */
function pickUnknownWhatsappSettings(company) {
  const raw =
    company?.unknown_whatsapp_settings ?? company?.unknownWhatsappSettings ?? null;
  const entry = Array.isArray(raw) ? raw[0] : raw;
  if (!entry || typeof entry !== 'object') {
    return { ...DEFAULT_UNKNOWN_WHATSAPP_SETTINGS };
  }
  const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    daily_limit: toNumber(
      entry.daily_limit ?? entry.dailyLimit,
      DEFAULT_UNKNOWN_WHATSAPP_SETTINGS.daily_limit
    ),
    usage: toNumber(entry.usage, DEFAULT_UNKNOWN_WHATSAPP_SETTINGS.usage),
    increase_daily: toNumber(
      entry.increase_daily ?? entry.increaseDaily,
      DEFAULT_UNKNOWN_WHATSAPP_SETTINGS.increase_daily
    ),
  };
}

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
  if (['not_available', 'unavailable'].includes(status)) return 'bg-secondary';
  return 'bg-secondary';
};

const messagePreview = (value) => {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '—';
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

/** Show WhatsApp numbers with Pakistan country code (92) for display. */
const formatWhatsappDisplayNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '—';
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return `92${digits}`;
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
  const companyId = useSelector(selectCompanyId);
  const authCompany = useSelector(selectCompany);
  const { canDelete } = usePermissions('whatsapp-messages');
  useRequireModuleAccess('whatsapp-messages');

  const [localSearch, setLocalSearch] = useState(search || '');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [stoppingId, setStoppingId] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    number: WHATSAPP_NUMBER_PREFIX,
    message: '',
  });
  const [sendErrors, setSendErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [resettingUsage, setResettingUsage] = useState(false);
  const searchTimeoutRef = useRef(null);

  const unknownWhatsappSettings = useMemo(
    () => pickUnknownWhatsappSettings(authCompany),
    [authCompany]
  );
  const companyWhatsappNumber = useMemo(
    () => getCompanyWhatsappNumber(authCompany),
    [authCompany]
  );

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
    if (!companyId) return undefined;
    let cancelled = false;
    fetchCompanyById(companyId)
      .then((body) => {
        if (cancelled) return;
        const fetched = getCompanyFromApiBody(body);
        if (!fetched) return;
        dispatch(setCompany({ ...(authCompany || {}), ...fetched }));
      })
      .catch(() => {
        /* keep existing company in session */
      });
    return () => {
      cancelled = true;
    };
    // Intentionally only re-fetch when companyId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authCompany used for merge only
  }, [companyId, dispatch]);

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

  const handleStatusTabChange = (tabId) => {
    dispatch(setStatusFilter(tabId));
  };

  const openSendModal = () => {
    setSendForm({ number: WHATSAPP_NUMBER_PREFIX, message: '' });
    setSendErrors({});
    setShowSendModal(true);
  };

  const closeSendModal = () => {
    if (sending) return;
    setShowSendModal(false);
    setSendErrors({});
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const number = normalizeWhatsappNumber(sendForm.number);
    const message = String(sendForm.message || '').trim();
    const nextErrors = {};
    if (!number.startsWith(WHATSAPP_NUMBER_PREFIX) || number.length < 3) {
      nextErrors.number = 'Enter a valid WhatsApp number starting with 92.';
    } else if (number.length > WHATSAPP_NUMBER_MAX_LENGTH) {
      nextErrors.number = 'Number must be 12 digits or less.';
    }
    if (!message) nextErrors.message = 'Message is required.';
    setSendErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSending(true);
    try {
      if (!companyWhatsappNumber) {
        throw new Error(
          'Company WhatsApp number is not set. Add it in Company settings.'
        );
      }
      const result = await createWhatsappMessageRequest({
        number,
        message,
        toUserId: companyWhatsappNumber,
      });
      if (result?.skipped) {
        toast.info(result?.message || 'Message already exists (skipped).');
      } else {
        toast.success(result?.message || 'Message saved successfully.');
      }
      setShowSendModal(false);
      setSendForm({ number: WHATSAPP_NUMBER_PREFIX, message: '' });
      loadMessages();
    } catch (err) {
      toast.error(err?.message || err || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const refreshCompanySettings = useCallback(async () => {
    if (!companyId) return;
    try {
      const body = await fetchCompanyById(companyId);
      const fetched = getCompanyFromApiBody(body);
      if (fetched) {
        dispatch(setCompany({ ...(authCompany || {}), ...fetched }));
      }
    } catch {
      /* keep existing company in session */
    }
  }, [authCompany, companyId, dispatch]);

  const handleResetUsage = async () => {
    if (!companyId || resettingUsage) return;
    if (
      !window.confirm(
        'Reset unknown WhatsApp usage for this company? The usage counter will be set back to zero.'
      )
    ) {
      return;
    }

    setResettingUsage(true);
    try {
      const result = await resetUnknownUsageOnlyRequest(companyId);
      toast.success(result?.message || 'Usage reset successfully.');
      await refreshCompanySettings();
    } catch (err) {
      toast.error(err?.message || err || 'Failed to reset usage');
    } finally {
      setResettingUsage(false);
    }
  };

  const handleStopSending = async (item) => {
    const id = messageIdFromRecord(item);
    if (!id) return;

    const displayNumber = formatWhatsappDisplayNumber(
      item.to_user_id || item.from_user_id || item.number
    );
    const number = displayNumber === '—' ? 'this number' : displayNumber;
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

  const apiSources = useMemo(() => {
    if (!DEBUG) return [];

    const listParams = new URLSearchParams();
    const page = pagination.page || 1;
    const limit = pagination.limit || 25;
    listParams.set('type', 'sent');
    listParams.set('skip', String((page - 1) * limit));
    listParams.set('limit', String(limit));
    if (search) listParams.set('search', search);
    if (sort.sortBy) {
      listParams.set('sortBy', sort.sortBy);
      if (sort.sortOrder) listParams.set('sortOrder', sort.sortOrder);
    }
    if (statusFilter) listParams.set('status', statusFilter);

    const mapStatus = (s) => {
      if (s === 'loading') return 'loading';
      if (s === 'failed') return 'error';
      if (s === 'succeeded') return 'success';
      return 'pending';
    };

    const sources = [
      {
        key: 'list',
        label: 'Messages list',
        url: buildApiUrl(`chat/get-all?${listParams.toString()}`),
        status: mapStatus(status),
        durationMs: null,
        error: status === 'failed' ? error : null,
      },
      {
        key: 'create',
        label: 'Insert chat (Send message)',
        url: buildApiUrl('chat/create/:pos_auth_token/swap'),
        status: sending ? 'loading' : 'pending',
        durationMs: null,
        error: null,
      },
      {
        key: 'delete',
        label: 'Stop sending (delete)',
        url: buildApiUrl('chat/delete/:id'),
        status: mapStatus(deleteStatus),
        durationMs: null,
        error: null,
      },
    ];

    if (companyId) {
      sources.push({
        key: 'company',
        label: 'Company (usage limits)',
        url: buildApiUrl(`company/get/${encodeURIComponent(companyId)}`),
        status: 'success',
        durationMs: null,
        error: null,
      });
      sources.push({
        key: 'resetUsage',
        label: 'Reset unknown usage',
        url: buildApiUrl(
          `chat/reset-unknown-usage-only?company_id=${encodeURIComponent(companyId)}`
        ),
        status: resettingUsage ? 'loading' : 'pending',
        durationMs: null,
        error: null,
      });
    }

    return sources;
  }, [
    pagination.page,
    pagination.limit,
    search,
    sort.sortBy,
    sort.sortOrder,
    statusFilter,
    status,
    error,
    sending,
    deleteStatus,
    companyId,
    resettingUsage,
  ]);

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
                </div>
                <div className="col-md-7">
                  <div className="d-flex justify-content-md-end gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning mb-0"
                      onClick={handleResetUsage}
                      disabled={!companyId || resettingUsage}
                      title="Reset unknown WhatsApp usage counter"
                    >
                      {resettingUsage ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-1"
                            role="status"
                            aria-hidden="true"
                          />
                          Resetting…
                        </>
                      ) : (
                        'Reset usage'
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary mb-0"
                      onClick={openSendModal}
                    >
                      Send message
                    </button>
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
              <div className="row g-2 mt-3">
                <div className="col-sm-4">
                  <div className="p-2 bg-gray-100 border-radius-md h-100">
                    <span className="text-xs text-uppercase text-muted d-block mb-1">
                      Daily Limit
                    </span>
                    <span className="text-sm mb-0 font-weight-bold">
                      {unknownWhatsappSettings.daily_limit}
                    </span>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="p-2 bg-gray-100 border-radius-md h-100">
                    <span className="text-xs text-uppercase text-muted d-block mb-1">Usage</span>
                    <span className="text-sm mb-0 font-weight-bold">
                      {unknownWhatsappSettings.usage}
                    </span>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="p-2 bg-gray-100 border-radius-md h-100">
                    <span className="text-xs text-uppercase text-muted d-block mb-1">
                      Increase Daily
                    </span>
                    <span className="text-sm mb-0 font-weight-bold">
                      {unknownWhatsappSettings.increase_daily}
                    </span>
                  </div>
                </div>
              </div>
              <ul
                className="nav nav-tabs whatsapp-status-tabs mt-3 border-0"
                role="tablist"
                aria-label="Filter by message status"
              >
                {STATUS_TABS.map((tab) => (
                  <li className="nav-item" key={tab.id || 'all'} role="presentation">
                    <button
                      type="button"
                      role="tab"
                      className={`nav-link ${statusFilter === tab.id ? 'active' : ''}`}
                      aria-selected={statusFilter === tab.id}
                      onClick={() => handleStatusTabChange(tab.id)}
                    >
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
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
                        column="from_user_id"
                        label="From"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <ListSortableTh
                        column="to_user_id"
                        label="To"
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
                        <td colSpan={showActionsColumn ? 8 : 7} className="text-center text-sm p-4">
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
                            <td className="text-sm">
                              {formatWhatsappDisplayNumber(item.from_user_id)}
                            </td>
                            <td className="text-sm">
                              {formatWhatsappDisplayNumber(item.to_user_id)}
                            </td>
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

          {DEBUG ? (
            <DevApiSourcesFooter sources={apiSources} className="mt-3" />
          ) : null}
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
                    <span className="text-sm text-muted">
                      From {formatWhatsappDisplayNumber(selectedMessage.from_user_id)}
                      {' → '}
                      To {formatWhatsappDisplayNumber(selectedMessage.to_user_id)}
                    </span>
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

      {showSendModal ? (
        <>
          <div
            className="modal fade show"
            style={{ display: 'block' }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsappSendMessageTitle"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <form onSubmit={handleSendMessage}>
                  <div className="modal-header">
                    <h5 className="modal-title" id="whatsappSendMessageTitle">
                      Send message
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={closeSendModal}
                      disabled={sending}
                    />
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label" htmlFor="whatsapp-send-number">
                        Number
                      </label>
                      <input
                        id="whatsapp-send-number"
                        type="tel"
                        inputMode="numeric"
                        maxLength={WHATSAPP_NUMBER_MAX_LENGTH}
                        className={`form-control ${sendErrors.number ? 'is-invalid' : ''}`}
                        value={sendForm.number}
                        onChange={(e) => {
                          const number = normalizeWhatsappNumber(e.target.value);
                          setSendForm((prev) => ({ ...prev, number }));
                          if (sendErrors.number) {
                            setSendErrors((prev) => {
                              const next = { ...prev };
                              delete next.number;
                              return next;
                            });
                          }
                        }}
                        disabled={sending}
                        autoFocus
                      />
                      {sendErrors.number ? (
                        <div className="invalid-feedback">{sendErrors.number}</div>
                      ) : null}
                    </div>
                    <div className="mb-0">
                      <label className="form-label" htmlFor="whatsapp-send-message">
                        Message
                      </label>
                      <textarea
                        id="whatsapp-send-message"
                        className={`form-control ${sendErrors.message ? 'is-invalid' : ''}`}
                        rows={4}
                        value={sendForm.message}
                        onChange={(e) => {
                          setSendForm((prev) => ({ ...prev, message: e.target.value }));
                          if (sendErrors.message) {
                            setSendErrors((prev) => {
                              const next = { ...prev };
                              delete next.message;
                              return next;
                            });
                          }
                        }}
                        disabled={sending}
                        placeholder="Type your message…"
                      />
                      {sendErrors.message ? (
                        <div className="invalid-feedback">{sendErrors.message}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary mb-0"
                      onClick={closeSendModal}
                      disabled={sending}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary mb-0" disabled={sending}>
                      {sending ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-1"
                            role="status"
                            aria-hidden="true"
                          />
                          Sending…
                        </>
                      ) : (
                        'Send message'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            onClick={closeSendModal}
            aria-hidden="true"
          />
        </>
      ) : null}
    </div>
  );
};

export default WhatsappMessages;
