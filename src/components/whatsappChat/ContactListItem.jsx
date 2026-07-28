import WhatsappAvatar from './WhatsappAvatar.jsx';
import { formatChatTime } from './chatUtils.jsx';

export default function ContactListItem({ contact, active, onSelect }) {
  return (
    <button
      type="button"
      className={`wa-contact-item${active ? ' is-active' : ''}`}
      onClick={() => onSelect(contact)}
    >
      <WhatsappAvatar name={contact.name} src={contact.avatarUrl} online={contact.online} />
      <div className="wa-contact-meta">
        <div className="wa-contact-top">
          <span className="wa-contact-name">{contact.name}</span>
          <span className="wa-contact-time">{formatChatTime(contact.lastMessageTime)}</span>
        </div>
        <div className="wa-contact-bottom">
          <span className="wa-contact-preview">
            {contact.lastMessage || contact.phone || '—'}
          </span>
          {contact.unread > 0 ? (
            <span className="wa-unread-badge">{contact.unread > 99 ? '99+' : contact.unread}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
