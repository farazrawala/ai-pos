import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FaUserCheck } from 'react-icons/fa6';
import {
  assignSupportTicket,
  clearActionStatus,
  clearCurrentTicket,
  fetchTicketById,
  replySupportTicket,
  updateTicketPriority,
  updateTicketStatus,
} from '../../../features/support/supportSlice.js';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  formatTicketId,
  personDisplayName,
  personEmail,
} from '../../../features/support/supportConstants.js';
import { fetchUsersRequest } from '../../../features/users/usersAPI.js';
import TicketDetailHeader, { formatCreatedMeta } from '../../../components/support/TicketDetailHeader.jsx';
import TicketTimeline from '../../../components/support/TicketTimeline.jsx';
import ReplyBox from '../../../components/support/ReplyBox.jsx';
import ImagePreviewModal from '../../../components/support/ImagePreviewModal.jsx';
import AppModal from '../../../components/AppModal.jsx';
import { useRequireModuleAccess } from '../../../hooks/useRequireModuleAccess.js';
import { toast } from '../../../utils/toast.js';
import '../../../styles/support-module.css';

const REFRESH_MS = 15000;

function extractMessages(ticket) {
  if (!ticket) return [];
  const list = ticket.messages || ticket.replies || ticket.conversation || [];
  return Array.isArray(list) ? list.filter((m) => m) : [];
}

export default function AdminTicketDetails() {
  const { isAdmin } = useRequireModuleAccess('support');
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    if (isAdmin === false) {
      navigate('/support', { replace: true });
    }
  }, [isAdmin, navigate]);

  const authUser = useSelector((state) => state.user.user);
  const { currentTicket, fetchStatus, fetchError, actionStatus } = useSelector((state) => state.support);

  const [preview, setPreview] = useState({ open: false, src: '', alt: '' });
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [saving, setSaving] = useState(false);
  const [olderMessages, setOlderMessages] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    dispatch(fetchTicketById({ id, scope: 'admin' }));
  }, [dispatch, id]);

  useEffect(() => {
    load();
    return () => {
      dispatch(clearCurrentTicket());
      dispatch(clearActionStatus());
    };
  }, [load, dispatch]);

  useEffect(() => {
    setOlderMessages([]);
    setHasMore(Boolean(currentTicket?.has_more_messages));
  }, [id, currentTicket?._id, currentTicket?.id]);

  useEffect(() => {
    if (!id) return undefined;
    const timer = setInterval(() => {
      dispatch(fetchTicketById({ id, scope: 'admin' }));
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [dispatch, id]);

  useEffect(() => {
    let cancelled = false;
    fetchUsersRequest({ page: 1, limit: 200, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => {
        if (cancelled) return;
        const users = Array.isArray(res?.data) ? res.data : [];
        setAdmins(users);
      })
      .catch(() => {
        if (!cancelled) setAdmins([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ticket = currentTicket;
  const customer = ticket?.user || ticket?.created_by || ticket?.customer;
  const status = String(ticket?.status || '').toLowerCase().replace(/\s+/g, '_');
  const isClosed = status === 'closed';

  const messages = useMemo(() => {
    const live = extractMessages(ticket);
    const map = new Map();
    [...olderMessages, ...live].forEach((m) => {
      const key = m._id || m.id || `${m.createdAt}-${m.message}`;
      map.set(key, m);
    });
    return Array.from(map.values()).sort((a, b) => {
      const ta = new Date(a.createdAt || a.created_at || 0).getTime();
      const tb = new Date(b.createdAt || b.created_at || 0).getTime();
      return ta - tb;
    });
  }, [ticket, olderMessages]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(formatTicketId(ticket));
      toast.success('Ticket ID copied.');
    } catch {
      toast.error('Could not copy ticket ID.');
    }
  };

  const handleReply = async ({ message, attachments, is_internal }) => {
    await dispatch(
      replySupportTicket({
        id,
        message,
        attachments,
        is_internal,
        role: 'admin',
      })
    ).unwrap();
    toast.success(is_internal ? 'Internal note added.' : 'Reply sent.');
  };

  const openAssign = () => {
    const current =
      (typeof ticket?.assigned_to === 'object'
        ? ticket.assigned_to?._id || ticket.assigned_to?.id
        : ticket?.assigned_to) ||
      authUser?._id ||
      authUser?.id ||
      '';
    setSelectedAssignee(String(current || ''));
    setAssignOpen(true);
  };

  const openStatus = () => {
    setSelectedStatus(status || 'open');
    setStatusOpen(true);
  };

  const openPriority = () => {
    setSelectedPriority(String(ticket?.priority || 'medium').toLowerCase());
    setPriorityOpen(true);
  };

  const saveAssign = async () => {
    setSaving(true);
    try {
      await dispatch(assignSupportTicket({ id, assignedTo: selectedAssignee || null })).unwrap();
      toast.success('Ticket assigned.');
      setAssignOpen(false);
    } catch (err) {
      toast.error(err || 'Failed to assign ticket.');
    } finally {
      setSaving(false);
    }
  };

  const saveStatus = async () => {
    setSaving(true);
    try {
      await dispatch(updateTicketStatus({ id, status: selectedStatus })).unwrap();
      toast.success('Status updated.');
      setStatusOpen(false);
    } catch (err) {
      toast.error(err || 'Failed to change status.');
    } finally {
      setSaving(false);
    }
  };

  const savePriority = async () => {
    setSaving(true);
    try {
      await dispatch(updateTicketPriority({ id, priority: selectedPriority })).unwrap();
      toast.success('Priority updated.');
      setPriorityOpen(false);
    } catch (err) {
      toast.error(err || 'Failed to change priority.');
    } finally {
      setSaving(false);
    }
  };

  const loadMore = async () => {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const before = oldest?.createdAt || oldest?.created_at || oldest?._id;
      const { getTicket } = await import('../../../features/support/supportAPI.js');
      const data = await getTicket(id, { before, limit: 20, scope: 'admin' });
      const older = extractMessages(data);
      if (older.length) setOlderMessages((prev) => [...older, ...prev]);
      setHasMore(Boolean(data?.has_more_messages));
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const loading = fetchStatus === 'loading' && !ticket;
  const created = ticket?.createdAt || ticket?.created_at;
  const currentUserId = String(authUser?._id || authUser?.id || '');

  return (
    <div className="container-fluid py-4 support-module support-module--detail">
      {loading ? (
        <div className="card shadow-sm border-0">
          <div className="card-body p-4">
            <div className="support-skeleton support-skeleton--line w-25 mb-3" />
            <div className="support-skeleton support-skeleton--line w-50 mb-4" />
            <div className="support-skeleton support-skeleton--card" style={{ height: 280 }} />
          </div>
        </div>
      ) : fetchError && !ticket ? (
        <div className="alert alert-danger" role="alert">
          {fetchError}
          <div className="mt-2">
            <button type="button" className="btn btn-sm btn-outline-danger mb-0" onClick={load}>
              Retry
            </button>
          </div>
        </div>
      ) : !ticket ? (
        <div className="alert alert-warning mb-0">Ticket not found.</div>
      ) : (
        <>
          <TicketDetailHeader
            ticket={ticket}
            closed={isClosed}
            onCopyId={copyId}
            refreshHint={`Auto-refreshes every ${REFRESH_MS / 1000}s`}
            breadcrumbs={[
              { label: 'Home', to: '/' },
              { label: 'Admin Support', to: '/admin/support' },
              { label: formatTicketId(ticket) },
            ]}
            metaItems={[
              { label: 'Customer', value: personDisplayName(customer) },
              ...(personEmail(customer)
                ? [{ label: 'Email', value: personEmail(customer) }]
                : []),
              { label: 'Created', value: formatCreatedMeta(created), title: created },
              {
                label: 'Assigned',
                value:
                  personDisplayName(ticket.assigned_to || ticket.assignee) !== '—'
                    ? personDisplayName(ticket.assigned_to || ticket.assignee)
                    : 'Unassigned',
              },
            ]}
            actions={
              <div className="d-flex gap-2 flex-wrap justify-content-end">
                <button type="button" className="btn btn-primary btn-sm mb-0" onClick={openAssign}>
                  <FaUserCheck className="me-1" />
                  Assign
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm mb-0" onClick={openStatus}>
                  Status
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm mb-0" onClick={openPriority}>
                  Priority
                </button>
              </div>
            }
          />

          <div className="card border-0 shadow-sm mb-3 support-conversation-card">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Conversation</h6>
              <span className="text-xs text-muted">
                {messages.length} message{messages.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="card-body p-0">
              <TicketTimeline
                messages={messages}
                loading={false}
                loadingMore={loadingMore}
                hasMore={hasMore}
                onLoadMore={loadMore}
                currentUserId={currentUserId}
                viewerIsAdmin
                onPreviewImage={(src, alt) => setPreview({ open: true, src, alt })}
              />
            </div>
          </div>

          {!isClosed ? (
            <ReplyBox
              sending={actionStatus === 'loading'}
              onSend={handleReply}
              showInternalToggle
              placeholder="Reply to customer or add an internal note…"
              submitLabel="Send Reply"
            />
          ) : (
            <div className="alert alert-secondary mb-0 border-0 shadow-sm">This ticket is closed.</div>
          )}
        </>
      )}

      <ImagePreviewModal
        open={preview.open}
        src={preview.src}
        alt={preview.alt}
        onClose={() => setPreview({ open: false, src: '', alt: '' })}
      />

      <AppModal
        open={assignOpen}
        onClose={() => !saving && setAssignOpen(false)}
        title="Assign ticket"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={() => setAssignOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary mb-0" onClick={saveAssign} disabled={saving}>
              {saving ? 'Saving…' : 'Assign'}
            </button>
          </>
        }
      >
        <label className="form-label" htmlFor="assign-admin">
          Assign to
        </label>
        <select
          id="assign-admin"
          className="form-select"
          value={selectedAssignee}
          onChange={(e) => setSelectedAssignee(e.target.value)}
        >
          <option value="">Unassigned</option>
          {admins.map((u) => (
            <option key={u._id || u.id} value={u._id || u.id}>
              {u.name || u.email || 'User'}
            </option>
          ))}
        </select>
      </AppModal>

      <AppModal
        open={statusOpen}
        onClose={() => !saving && setStatusOpen(false)}
        title="Change status"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={() => setStatusOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary mb-0" onClick={saveStatus} disabled={saving}>
              {saving ? 'Saving…' : 'Update'}
            </button>
          </>
        }
      >
        <label className="form-label" htmlFor="change-status">
          Status
        </label>
        <select
          id="change-status"
          className="form-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          {TICKET_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </AppModal>

      <AppModal
        open={priorityOpen}
        onClose={() => !saving && setPriorityOpen(false)}
        title="Change priority"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={() => setPriorityOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary mb-0" onClick={savePriority} disabled={saving}>
              {saving ? 'Saving…' : 'Update'}
            </button>
          </>
        }
      >
        <label className="form-label" htmlFor="change-priority">
          Priority
        </label>
        <select
          id="change-priority"
          className="form-select"
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
        >
          {TICKET_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </AppModal>
    </div>
  );
}
