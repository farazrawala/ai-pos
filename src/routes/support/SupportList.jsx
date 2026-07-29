import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import { FaPlus, FaEye } from 'react-icons/fa6';
import {
  fetchTickets,
  setFilters,
  resetFilters,
  setPage,
  setLimit,
} from '../../features/support/supportSlice.js';
import {
  formatTicketId,
  getTicketId,
} from '../../features/support/supportConstants.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import TablePagination from '../../components/TablePagination.jsx';
import TicketFilters from '../../components/support/TicketFilters.jsx';
import TicketStatusBadge from '../../components/support/TicketStatusBadge.jsx';
import PriorityBadge from '../../components/support/PriorityBadge.jsx';
import TicketEmptyState from '../../components/support/TicketEmptyState.jsx';
import TicketCard from '../../components/support/TicketCard.jsx';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import '../../styles/support-module.css';

export default function SupportList() {
  useRequireModuleAccess('support');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, listStatus, listError, pagination, filters, sort } = useSelector((state) => state.support);
  const [viewMode, setViewMode] = useState('table');
  const searchDebounceRef = useRef(null);
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const load = useCallback(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      scope: 'user',
    };
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.category) params.category = filters.category;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchTickets(params));
  }, [dispatch, pagination.page, pagination.limit, filters, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilterChange = (next) => {
    setLocalFilters(next);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      dispatch(setFilters(next));
    }, 400);
  };

  const handleReset = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setLocalFilters({
      search: '',
      status: '',
      priority: '',
      category: '',
      assigned_to: '',
      date_from: '',
      date_to: '',
    });
    dispatch(resetFilters());
  };

  const loading = listStatus === 'loading';
  const error = listError;

  return (
    <div className="container-fluid py-4 support-module">
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb bg-transparent mb-0 p-0">
          <li className="breadcrumb-item">
            <Link to="/">Home</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Support
          </li>
        </ol>
      </nav>

      <div className="card shadow-sm border-0">
        <div className="card-header bg-transparent border-0 pb-0">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h5 className="mb-0">Support Tickets</h5>
              <p className="text-sm text-muted mb-0">Track and manage your support conversations</p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="btn-group btn-group-sm" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={`btn mb-0 ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </button>
                <button
                  type="button"
                  className={`btn mb-0 ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setViewMode('cards')}
                >
                  Cards
                </button>
              </div>
              <Link to="/support/new" className="btn btn-primary btn-sm mb-0">
                <FaPlus className="me-1" />
                Create Ticket
              </Link>
            </div>
          </div>
          <div className="mt-3">
            <TicketFilters filters={localFilters} onChange={handleFilterChange} onReset={handleReset} />
          </div>
        </div>

        <div className="card-body pt-3">
          {viewMode === 'cards' ? (
            loading ? (
              <div className="row g-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="col-12 col-md-6 col-xl-4">
                    <div className="support-skeleton support-skeleton--card" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="alert alert-danger mb-0" role="alert">
                {error}
                <div className="mt-2">
                  <button type="button" className="btn btn-sm btn-outline-danger mb-0" onClick={load}>
                    Retry
                  </button>
                </div>
              </div>
            ) : list.length === 0 ? (
              <TicketEmptyState
                action={
                  <Link to="/support/new" className="btn btn-primary btn-sm mb-0">
                    Create your first ticket
                  </Link>
                }
              />
            ) : (
              <>
                <div className="row g-3">
                  {list.map((ticket) => (
                    <div key={getTicketId(ticket)} className="col-12 col-md-6 col-xl-4">
                      <TicketCard ticket={ticket} />
                    </div>
                  ))}
                </div>
                <TablePagination
                  className="mt-3"
                  selectId="support-cards-page-size"
                  pagination={pagination}
                  onPageChange={(p) => dispatch(setPage(p))}
                  onLimitChange={(l) => dispatch(setLimit(l))}
                />
              </>
            )
          ) : (
            <ListDataTable
              loading={loading}
              loadingLabel="Loading tickets…"
              error={error}
              errorPrefix="Error loading tickets"
              onRetry={load}
              pagination={pagination}
              onPageChange={(p) => dispatch(setPage(p))}
              onLimitChange={(l) => dispatch(setLimit(l))}
              selectId="support-page-size"
            >
              <table className="table align-items-center mb-0">
                <thead>
                  <tr>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Ticket ID</th>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Subject</th>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Category</th>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Priority</th>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Status</th>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Last Updated</th>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Created</th>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Unread</th>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <TicketEmptyState
                          action={
                            <Link to="/support/new" className="btn btn-primary btn-sm mb-0">
                              Create your first ticket
                            </Link>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    list.map((ticket) => {
                      const id = getTicketId(ticket);
                      const unread = Number(ticket.unread_count ?? ticket.unreadCount ?? 0);
                      const updated = ticket.updatedAt || ticket.updated_at || ticket.last_reply_at;
                      const created = ticket.createdAt || ticket.created_at;
                      return (
                        <tr
                          key={id}
                          className="support-table-row"
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/support/${id}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/support/${id}`);
                            }
                          }}
                        >
                          <td className="ps-3">
                            <span className="font-monospace text-xs">{formatTicketId(ticket)}</span>
                          </td>
                          <td>
                            <span className="text-sm font-weight-bold text-dark">{ticket.subject || '—'}</span>
                          </td>
                          <td>
                            <span className="text-sm">{ticket.category || '—'}</span>
                          </td>
                          <td>
                            <PriorityBadge priority={ticket.priority} />
                          </td>
                          <td>
                            <TicketStatusBadge status={ticket.status} />
                          </td>
                          <td>
                            <span className="text-xs text-muted" title={updated ? moment(updated).format('LLLL') : ''}>
                              {updated ? moment(updated).fromNow() : '—'}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs text-muted" title={created ? moment(created).format('LLLL') : ''}>
                              {created ? moment(created).format('MMM D, YYYY') : '—'}
                            </span>
                          </td>
                          <td>
                            {unread > 0 ? (
                              <span className="badge bg-danger badge-sm">{unread}</span>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-primary mb-0 p-0"
                              onClick={() => navigate(`/support/${id}`)}
                              title="View ticket"
                            >
                              <FaEye className="me-1" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ListDataTable>
          )}
        </div>
      </div>
    </div>
  );
}
