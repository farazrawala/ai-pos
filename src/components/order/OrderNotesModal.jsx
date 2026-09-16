import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from 'moment';
import {
  FaClockRotateLeft,
  FaCommentDots,
  FaPaperPlane,
  FaRotateRight,
  FaUser,
  FaXmark,
} from 'react-icons/fa6';
import {
  createOrderNoteRequest,
  fetchOrderNotesRequest,
  fetchOrderStatusUpdatesRequest,
  updateOrderNotesRequest,
} from '../../features/orders/ordersAPI.js';
import NavIcon from '../NavIcon.jsx';
import './order-notes-popup.css';

export const ORDER_NOTE_TYPE_OPTIONS = [
  { value: 'notes', label: 'Type: Notes' },
  { value: 'customer', label: 'Customer' },
  { value: 'courier', label: 'Courier' },
  { value: 'courier_ticket', label: 'Courier Ticket' },
  { value: 'cancellation', label: 'Cancellation Note' },
  { value: 'refund', label: 'Refund Note' },
  { value: 'exchange', label: 'Exchange Note' },
  { value: 'return', label: 'Return Note' },
  { value: 'complaint', label: 'Complaint Note' },
  { value: 'hold', label: 'Hold Note' },
  { value: 'reattempt', label: 'Reattempt Note' },
  { value: 'stop_working', label: 'Stop Working Note' },
  { value: 'claim', label: 'Claim Note' },
];

export const ORDER_NOTE_QUICK_TAGS = [
  'CNA',
  'WNA',
  'COW',
  'APOD',
  'NOF',
  'FKC',
  'COM',
  'UG',
  'FKS',
];

const userLabel = (user) => {
  if (!user) return 'System';
  if (typeof user === 'string' && user.trim()) return user.trim();
  if (typeof user === 'object') {
    return (
      String(user.name ?? user.fullName ?? user.username ?? user.email ?? '').trim() || 'User'
    );
  }
  return 'User';
};

const userAvatar = (user) => {
  if (!user || typeof user !== 'object') return '';
  return String(
    user.profile_image ?? user.profileImage ?? user.avatar ?? user.image ?? user.photo ?? ''
  ).trim();
};

const formatWhen = (value) => {
  if (!value) return '';
  const parsed = moment(value);
  return parsed.isValid() ? parsed.format('DD MMM · h:mm A') : String(value);
};

const entryKind = (entry) => {
  if (entry?.source === 'status') return 'status';
  if (entry?.source === 'seed') return 'seed';
  return 'note';
};

const noteTextFromRow = (row) => {
  if (!row || typeof row !== 'object') return '';
  return String(
    row.note ??
      row.notes ??
      row.message ??
      row.text ??
      row.comment ??
      row.description ??
      ''
  ).trim();
};

const normalizeNoteRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const text = noteTextFromRow(row);
      const from = String(row.from_status ?? row.fromStatus ?? '').trim();
      const to = String(row.to_status ?? row.toStatus ?? row.order_status ?? '').trim();
      const statusLine =
        !text && from && to
          ? `Order moved to ${to.replace(/_/g, ' ')} from ${from.replace(/_/g, ' ')}`
          : !text && to
            ? `Order status: ${to.replace(/_/g, ' ')}`
            : text;
      if (!statusLine) return null;
      const createdBy = row.created_by ?? row.updated_by ?? row.user_id ?? row.user ?? null;
      return {
        id: String(row._id ?? row.id ?? `note-${index}`),
        userName: userLabel(createdBy),
        avatarUrl: userAvatar(createdBy),
        createdAt: row.createdAt ?? row.created_at ?? row.updatedAt ?? row.updated_at ?? '',
        text: statusLine,
        type: String(row.type ?? row.note_type ?? row.noteType ?? 'notes').trim() || 'notes',
        source: row.__source || 'note',
      };
    })
    .filter(Boolean);

/**
 * Order notes popup — history feed + typed note composer.
 */
export default function OrderNotesModal({
  open,
  orderId,
  orderNo,
  currentNote = '',
  onClose,
  onSaved,
}) {
  const panelRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [loadError, setLoadError] = useState(null);
  const [noteType, setNoteType] = useState('notes');
  const [draft, setDraft] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);

  const titleOrderNo = useMemo(() => {
    const raw = String(orderNo || '').trim() || 'Order';
    return raw.startsWith('#') ? raw : `#${raw}`;
  }, [orderNo]);

  const loadNotes = useCallback(async () => {
    if (!orderId) {
      setEntries([]);
      setLoadError('Missing order id.');
      setLoadStatus('failed');
      return;
    }

    setLoadStatus('loading');
    setLoadError(null);

    const collected = [];

    try {
      const notesResult = await fetchOrderNotesRequest({ order_id: orderId, limit: 100 });
      collected.push(
        ...normalizeNoteRows(
          (notesResult?.data || []).map((row) => ({ ...row, __source: 'note' }))
        )
      );
    } catch {
      // Notes collection may not exist yet — continue with fallbacks.
    }

    try {
      const statusResult = await fetchOrderStatusUpdatesRequest({
        order_id: orderId,
        limit: 50,
      });
      collected.push(
        ...normalizeNoteRows(
          (statusResult?.data || []).map((row) => ({ ...row, __source: 'status' }))
        )
      );
    } catch {
      // Status history is optional enrichment.
    }

    const seed = String(currentNote || '').trim();
    if (seed && !collected.some((item) => item.text === seed)) {
      collected.push({
        id: 'seed-current-note',
        userName: 'Note',
        avatarUrl: '',
        createdAt: '',
        text: seed,
        type: 'notes',
        source: 'seed',
      });
    }

    collected.sort((a, b) => {
      const aTime = a.createdAt ? moment(a.createdAt).valueOf() : 0;
      const bTime = b.createdAt ? moment(b.createdAt).valueOf() : 0;
      return bTime - aTime;
    });

    // Dedupe by id + text
    const seen = new Set();
    const unique = [];
    for (const item of collected) {
      const key = `${item.id}::${item.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }

    setEntries(unique);
    setLoadStatus('succeeded');
  }, [orderId, currentNote]);

  useEffect(() => {
    if (!open) return;
    setNoteType('notes');
    setDraft('');
    setSaveStatus('idle');
    setSaveError(null);
    loadNotes();
  }, [open, orderId, loadNotes]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const appendQuickTag = (tag) => {
    setDraft((prev) => {
      const base = String(prev || '').trimEnd();
      if (!base) return `[${tag}] `;
      if (base.includes(`[${tag}]`)) return base;
      return `${base} [${tag}]`;
    });
  };

  const handleSubmit = async () => {
    const text = String(draft || '').trim();
    if (!text) {
      setSaveError('Type a note first.');
      return;
    }
    if (!orderId) {
      setSaveError('Missing order id.');
      return;
    }

    setSaveStatus('loading');
    setSaveError(null);

    const typeLabel =
      ORDER_NOTE_TYPE_OPTIONS.find((opt) => opt.value === noteType)?.label?.replace(/^Type:\s*/i, '') ||
      noteType;
    const typedPrefix =
      noteType && noteType !== 'notes' ? `[${String(typeLabel).toUpperCase()}] ` : '';
    const composed = `${typedPrefix}${text}`.trim();

    try {
      let savedViaCreate = false;
      try {
        await createOrderNoteRequest({
          order_id: orderId,
          type: noteType,
          note: composed,
        });
        savedViaCreate = true;
      } catch {
        // Fallback: persist on order.note (append)
        const previous = String(currentNote || '').trim();
        const nextNote = previous ? `${previous}\n${composed}` : composed;
        await updateOrderNotesRequest(orderId, { note: nextNote });
        onSaved?.({ orderId, orderNo, note: nextNote });
      }

      if (savedViaCreate) {
        onSaved?.({ orderId, orderNo, note: composed });
      }

      setDraft('');
      setSaveStatus('succeeded');
      await loadNotes();
    } catch (err) {
      setSaveStatus('failed');
      setSaveError(err?.message || 'Failed to save note.');
    }
  };

  if (!open) return null;

  const isLoading = loadStatus === 'loading';
  const isSaving = saveStatus === 'loading';

  return (
    <>
      <div
        className="oms-notes-backdrop"
        role="presentation"
        onClick={onClose}
      />
      <div
        className="oms-notes-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orderNotesPopupTitle"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="oms-notes-popup__header">
          <div className="oms-notes-popup__header-main">
            <div className="oms-notes-popup__icon" aria-hidden="true">
              <NavIcon icon={FaCommentDots} size={15} />
            </div>
            <div className="min-w-0">
              <p className="oms-notes-popup__eyebrow">Order notes</p>
              <h5 className="oms-notes-popup__title" id="orderNotesPopupTitle">
                Order Notes - {titleOrderNo}
              </h5>
            </div>
          </div>
          <button
            type="button"
            className="oms-notes-popup__close"
            aria-label="Close"
            onClick={onClose}
            disabled={isSaving}
          >
            <NavIcon icon={FaXmark} size={14} />
          </button>
        </div>

        <div className="oms-notes-popup__body">
          {loadError ? (
            <div className="alert alert-warning text-sm py-2 mb-2" role="alert">
              {loadError}
            </div>
          ) : null}

          <div className="oms-notes-feed">
            {isLoading && entries.length === 0 ? (
              <p className="oms-notes-empty">Loading notes…</p>
            ) : null}
            {!isLoading && entries.length === 0 ? (
              <p className="oms-notes-empty">No notes yet. Add the first one below.</p>
            ) : null}
            {entries.map((entry) => {
              const kind = entryKind(entry);
              const AvatarIcon = kind === 'status' ? FaClockRotateLeft : FaUser;
              return (
                <div
                  key={entry.id}
                  className={`oms-notes-item oms-notes-item--${kind}`}
                >
                  <div className="oms-notes-item__avatar" aria-hidden="true">
                    {entry.avatarUrl ? (
                      <img src={entry.avatarUrl} alt="" />
                    ) : (
                      <span className="oms-notes-item__avatar-fallback">
                        <NavIcon icon={AvatarIcon} size={12} />
                      </span>
                    )}
                  </div>
                  <div className="oms-notes-item__content">
                    <div className="oms-notes-item__meta">
                      <span className="oms-notes-item__user">{entry.userName}</span>
                      <span
                        className={`oms-notes-item__badge oms-notes-item__badge--${
                          kind === 'status' ? 'status' : 'note'
                        }`}
                      >
                        {kind === 'status' ? 'Status' : 'Note'}
                      </span>
                      {entry.createdAt ? (
                        <span className="oms-notes-item__when">
                          {formatWhen(entry.createdAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="oms-notes-item__bubble">{entry.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="oms-notes-popup__composer">
          {saveError ? (
            <div className="alert alert-danger text-sm py-1 px-2 mb-2" role="alert">
              {saveError}
            </div>
          ) : null}

          <div className="oms-notes-composer__type-row">
            <label className="oms-notes-composer__label" htmlFor="omsNotesType">
              Note type
            </label>
            <select
              id="omsNotesType"
              className="form-select form-select-sm oms-notes-composer__type"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              disabled={isSaving}
              aria-label="Note type"
            >
              {ORDER_NOTE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="oms-notes-composer__input-row">
            <textarea
              className="form-control form-control-sm oms-notes-composer__input"
              placeholder="Write a note..."
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={isSaving}
              autoFocus
              aria-label="Note text"
            />
            <button
              type="button"
              className="btn btn-sm oms-notes-composer__submit"
              onClick={handleSubmit}
              disabled={isSaving || !orderId}
              title="Add note"
              aria-label="Add note"
            >
              {isSaving ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden />
              ) : (
                <NavIcon icon={FaPaperPlane} size={13} />
              )}
              <span className="oms-notes-composer__submit-label">
                {isSaving ? 'Saving' : 'Send'}
              </span>
            </button>
          </div>

          <div className="oms-notes-composer__tags" role="group" aria-label="Quick note tags">
            {ORDER_NOTE_QUICK_TAGS.map((tag) => {
              const selected = draft.includes(`[${tag}]`);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`oms-notes-tag${selected ? ' oms-notes-tag--active' : ''}`}
                  onClick={() => appendQuickTag(tag)}
                  disabled={isSaving}
                  aria-pressed={selected}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="oms-notes-composer__actions">
            <button
              type="button"
              className="btn btn-sm oms-notes-composer__refresh"
              onClick={loadNotes}
              disabled={isLoading || isSaving}
            >
              <NavIcon
                icon={FaRotateRight}
                size={12}
                className={isLoading ? 'oms-notes-composer__refresh-icon--spin' : ''}
              />
              {isLoading ? 'Loading…' : 'Get notes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Teal notes trigger icon used in OMS customer cells. Opens popup on click. */
export function OrderNotesIconButton({
  hasNotes = false,
  disabled = false,
  onClick,
  title = 'Order notes',
}) {
  return (
    <button
      type="button"
      className={`btn p-0 mb-0 oms-notes-trigger${hasNotes ? ' oms-notes-trigger--active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      <NavIcon icon={FaCommentDots} size={14} />
    </button>
  );
}
