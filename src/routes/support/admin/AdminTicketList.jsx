import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import { FaEye } from 'react-icons/fa6';
import {
  fetchTickets,
  setFilters,
  resetFilters,
  setPage,
  setLimit,
} from '../../../features/support/supportSlice.js';
import {
  formatTicketId,
  getTicketId,
  personDisplayName,
} from '../../../features/support/supportConstants.js';
import { fetchUsersRequest } from '../../../features/users/usersAPI.js';
import ListDataTable from '../../../components/list/ListDataTable.jsx';
import TicketFilters from '../../../components/support/TicketFilters.jsx';
import TicketStatusBadge from '../../../components/support/TicketStatusBadge.jsx';
import PriorityBadge from '../../../components/support/PriorityBadge.jsx';
import TicketEmptyState from '../../../components/support/TicketEmptyState.jsx';
import { useRequireModuleAccess } from '../../../hooks/useRequireModuleAccess.js';
import '../../../styles/support-module.css';

export default function AdminTicketList() {
  const { isAdmin } = useRequireModuleAccess('support');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    if (isAdmin === false) {
      navigate('/support', { replace: true });
    }
  }, [isAdmin, navigate]);

  const { list, listStatus, listError, pagination, filters, sort } = useSelector((state) => state.support);
  const [localFilters, setLocalFilters] = useState(filters);
  const [admins, setAdmins] = useState([]);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    fetchUsersRequest({ page: 1, limit: 200, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => {
        if (cancelled) return;
        const users = Array.isArray(res?.data) ? res.data : [];
        setAdmins(
          users.filter((u) => {
            const roles = []
              .concat(u.role || [])
              .concat(u.roles || [])
              .map((r) => String(typeof r === 'object' ? r.name || r.role || '' : r).toUpperCase());
            return roles.includes('ADMIN') || roles.includes('SUPPORT');
          })
        );
      })
      .catch(() => {
        if (!cancelled) setAdmins([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      scope: 'admin',
    };
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.category) params.category = filters.category;
    if (filters.assigned_to) params.assigned_to = filters.assigned_to;
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

  if (!isAdmin) {
    return null;
  }

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

  return (
    <div className="container-fluid py-4 support-module">
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb bg-transparent mb-0 p-0">
          <li className="breadcrumb-item">
            <Link to="/">Home</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Admin Support
          </li>
        </ol>
      </nav>

      <div className="card shadow-sm border-0">
        <div className="card-header bg-transparent border-0 pb-0">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div>
              <h5 className="mb-0">Ticket Management</h5>
              <p className="text-sm text-muted mb-0">Assign, prioritize, and resolve customer tickets</p>
            </div>
          </div>
          <TicketFilters
            filters={localFilters}
            onChange={handleFilterChange}
            onReset={handleReset}
            showAssigned
            assignedOptions={admins}
          />
        </div>

        <div className="card-body pt-3">
          <ListDataTable
            loading={listStatus === 'loading'}
            loadingLabel="Loading tickets…"
            error={listError}
            errorPrefix="Error loading tickets"
            onRetry={load}
            pagination={pagination}
            onPageChange={(p) => dispatch(setPage(p))}
            onLimitChange={(l) => dispatch(setLimit(l))}
            selectId="admin-support-page-size"
          >
            <table className="table align-items-center mb-0">
              <thead>
                <tr>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Ticket ID</th>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">User</th>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Subject</th>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Priority</th>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Status</th>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Category</th>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Created</th>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Last Reply</th>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Assigned To</th>
                  <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <TicketEmptyState
                        title="No tickets found"
                        description="Customer tickets will appear here when submitted."
                      />
                    </td>
                  </tr>
                ) : (
                  list.map((ticket) => {
                    const tid = getTicketId(ticket);
                    const created = ticket.createdAt || ticket.created_at;
                    const lastReply = ticket.last_reply_at || ticket.updatedAt || ticket.updated_at;
                    const unread = Number(ticket.unread_count ?? ticket.unreadCount ?? 0);
                    return (
                      <tr
                        key={tid}
                        className="support-table-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/admin/support/${tid}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/admin/support/${tid}`);
                          }
                        }}
                      >
                        <td className="ps-3">
                          <span className="font-monospace text-xs">{formatTicketId(ticket)}</span>
                          {unread > 0 ? (
                            <span className="badge bg-danger badge-sm ms-1" title="Unread">
                              {unread}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <span className="text-sm">{personDisplayName(ticket.user || ticket.created_by || ticket.customer)}</span>
                        </td>
                        <td>
                          <span className="text-sm font-weight-bold text-dark">{ticket.subject || '—'}</span>
                        </td>
                        <td>
                          <PriorityBadge priority={ticket.priority} />
                        </td>
                        <td>
                          <TicketStatusBadge status={ticket.status} />
                        </td>
                        <td>
                          <span className="text-sm">{ticket.category || '—'}</span>
                        </td>
                        <td>
                          <span className="text-xs text-muted">
                            {created ? moment(created).format('MMM D, YYYY') : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-muted">
                            {lastReply ? moment(lastReply).fromNow() : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm">
                            {personDisplayName(ticket.assigned_to || ticket.assignee) !== '—'
                              ? personDisplayName(ticket.assigned_to || ticket.assignee)
                              : 'Unassigned'}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-primary mb-0 p-0"
                            onClick={() => navigate(`/admin/support/${tid}`)}
                          >
                            <FaEye className="me-1" />
                            Manage
                          </button>
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
  );
}
