import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  clearCurrentTicket,
  clearActionStatus,
  fetchTicketById,
  replySupportTicket,
  updateTicketStatus,
} from '../../features/support/supportSlice.js';
import {
  formatTicketId,
  personDisplayName,
} from '../../features/support/supportConstants.js';
import TicketDetailHeader, { formatCreatedMeta } from '../../components/support/TicketDetailHeader.jsx';
import TicketTimeline from '../../components/support/TicketTimeline.jsx';
import ReplyBox from '../../components/support/ReplyBox.jsx';
import ImagePreviewModal from '../../components/support/ImagePreviewModal.jsx';
import ConfirmDialog from '../../components/support/ConfirmDialog.jsx';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';
import '../../styles/support-module.css';

const REFRESH_MS = 20000;

function extractMessages(ticket) {
  if (!ticket) return [];
  const list = ticket.messages || ticket.replies || ticket.conversation || [];
  return Array.isArray(list) ? [...list] : [];
}

export default function TicketDetails() {
  useRequireModuleAccess('support');
  const { id } = useParams();
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.user.user);
  const { currentTicket, fetchStatus, fetchError, actionStatus } = useSelector((state) => state.support);
  const [preview, setPreview] = useState({ open: false, src: '', alt: '' });
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [olderMessages, setOlderMessages] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const currentUserId = String(authUser?._id || authUser?.id || '');

  const load = useCallback(() => {
    if (!id) return;
    dispatch(fetchTicketById({ id, scope: 'user' }));
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
      dispatch(fetchTicketById({ id, scope: 'user' }));
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [dispatch, id]);

  const ticket = currentTicket;
  const status = String(ticket?.status || '').toLowerCase().replace(/\s+/g, '_');
  const isClosed = status === 'closed';
  const isResolved = status === 'resolved';
  const canReply = ticket && !isClosed;
  const canClose = ticket && isResolved;

  const messages = useMemo(() => {
    const live = extractMessages(ticket).filter((m) => !(m.is_internal || m.isInternal));
    const map = new Map();
    [...olderMessages, ...live].forEach((m) => {
      if (m.is_internal || m.isInternal) return;
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
    const label = formatTicketId(ticket);
    try {
      await navigator.clipboard.writeText(label);
      toast.success('Ticket ID copied.');
    } catch {
      toast.error('Could not copy ticket ID.');
    }
  };

  const handleReply = async ({ message, attachments }) => {
    await dispatch(
      replySupportTicket({
        id,
        message,
        attachments,
      })
    ).unwrap();
    toast.success('Reply sent.');
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      await dispatch(updateTicketStatus({ id, status: 'closed' })).unwrap();
      toast.success('Ticket closed.');
      setConfirmClose(false);
    } catch (err) {
      toast.error(err || 'Failed to close ticket.');
    } finally {
      setClosing(false);
    }
  };

  const loadMore = async () => {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const before = oldest?.createdAt || oldest?.created_at || oldest?._id;
      const { getTicket } = await import('../../features/support/supportAPI.js');
      const data = await getTicket(id, { before, limit: 20, scope: 'user' });
      const older = extractMessages(data);
      if (older.length) {
        setOlderMessages((prev) => [...older, ...prev]);
      }
      setHasMore(Boolean(data?.has_more_messages));
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const loading = fetchStatus === 'loading' && !ticket;
  const created = ticket?.createdAt || ticket?.created_at;
  const createdBy = personDisplayName(ticket?.user || ticket?.created_by || ticket?.customer);

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
              { label: 'Support', to: '/support' },
              { label: formatTicketId(ticket) },
            ]}
            metaItems={[
              { label: 'Created by', value: createdBy },
              { label: 'Created', value: formatCreatedMeta(created), title: created },
              { label: 'Messages', value: String(messages.length) },
            ]}
            actions={
              canClose ? (
                <button
                  type="button"
                  className="btn btn-outline-dark btn-sm mb-0"
                  onClick={() => setConfirmClose(true)}
                >
                  Close Ticket
                </button>
              ) : null
            }
          />

          <div className="card border-0 shadow-sm mb-3 support-conversation-card">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Conversation</h6>
              <span className="text-xs text-muted">{messages.length} message{messages.length === 1 ? '' : 's'}</span>
            </div>
            <div className="card-body p-0">
              <TicketTimeline
                messages={messages}
                loading={false}
                loadingMore={loadingMore}
                hasMore={hasMore}
                onLoadMore={loadMore}
                currentUserId={currentUserId}
                viewerIsAdmin={false}
                onPreviewImage={(src, alt) => setPreview({ open: true, src, alt })}
              />
            </div>
          </div>

          {canReply ? (
            <ReplyBox
              sending={actionStatus === 'loading'}
              onSend={handleReply}
              placeholder="Write a reply…"
            />
          ) : (
            <div className="alert alert-secondary mb-0 border-0 shadow-sm">
              This ticket is closed. You cannot reply or reopen it.
            </div>
          )}
        </>
      )}

      <ImagePreviewModal
        open={preview.open}
        src={preview.src}
        alt={preview.alt}
        onClose={() => setPreview({ open: false, src: '', alt: '' })}
      />

      <ConfirmDialog
        open={confirmClose}
        title="Close ticket?"
        message="Closing confirms the issue is resolved. You will not be able to reopen this ticket."
        confirmLabel="Close Ticket"
        variant="danger"
        loading={closing}
        onConfirm={handleClose}
        onClose={() => setConfirmClose(false)}
      />
    </div>
  );
}
