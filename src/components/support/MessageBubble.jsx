import moment from 'moment';
import { personDisplayName } from '../../features/support/supportConstants.js';
import AttachmentPreview from './AttachmentPreview.jsx';

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function authorId(message) {
  const ref = message?.user || message?.author || message?.created_by;
  if (ref && typeof ref === 'object') return String(ref._id || ref.id || '');
  return String(ref || '');
}

export default function MessageBubble({ message, onPreviewImage, currentUserId = '', viewerIsAdmin = false }) {
  if (!message) return null;

  const isInternal = Boolean(message.is_internal || message.isInternal);
  const roleRaw = String(message.role || message.sender_role || '').toLowerCase();
  const isAdminMsg = roleRaw === 'admin' || roleRaw === 'agent' || isInternal;
  const author = personDisplayName(message.user || message.author || message.created_by) || message.name || 'User';
  const roleLabel = isInternal ? 'Internal note' : isAdminMsg ? 'Support' : 'Customer';
  const body = message.message || message.body || message.content || '';
  const createdAt = message.createdAt || message.created_at || message.date;
  const attachments = message.attachments || message.files || [];

  const mineById = currentUserId && authorId(message) && authorId(message) === String(currentUserId);
  // Align: own messages on the right; support/admin opposite of customer viewer.
  const isMine = mineById || (viewerIsAdmin ? isAdminMsg : !isAdminMsg);

  return (
    <div
      className={[
        'support-bubble',
        isMine ? 'support-bubble--mine' : 'support-bubble--theirs',
        isAdminMsg ? 'support-bubble--admin' : 'support-bubble--user',
        isInternal ? 'support-bubble--internal' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {!isMine ? (
        <div className={`support-bubble__avatar ${isAdminMsg ? 'is-admin' : 'is-user'}`} aria-hidden>
          {initials(author)}
        </div>
      ) : null}

      <div className="support-bubble__stack">
        <div className="support-bubble__meta">
          <strong className="support-bubble__name">{author}</strong>
          <span
            className={`support-role-tag ${
              isInternal ? 'is-internal' : isAdminMsg ? 'is-admin' : 'is-user'
            }`}
          >
            {roleLabel}
          </span>
          {createdAt ? (
            <time className="support-bubble__time" dateTime={createdAt} title={moment(createdAt).format('LLLL')}>
              {moment(createdAt).calendar(null, {
                sameDay: '[Today,] h:mm A',
                lastDay: '[Yesterday,] h:mm A',
                lastWeek: 'ddd, h:mm A',
                sameElse: 'MMM D, YYYY h:mm A',
              })}
            </time>
          ) : null}
        </div>

        <div className="support-bubble__body">
          {body ? <div className="support-bubble__text">{body}</div> : null}
          {Array.isArray(attachments) && attachments.length > 0 ? (
            <div className="support-bubble__attachments">
              {attachments.map((att, idx) => (
                <AttachmentPreview
                  key={att._id || att.id || `att-${idx}`}
                  attachment={att}
                  compact
                  onPreviewImage={onPreviewImage}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {isMine ? (
        <div className={`support-bubble__avatar ${isAdminMsg ? 'is-admin' : 'is-user'}`} aria-hidden>
          {initials(author)}
        </div>
      ) : null}
    </div>
  );
}
