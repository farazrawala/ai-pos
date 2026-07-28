import { FaClock, FaMagnifyingGlass, FaPaperclip, FaFaceSmile, FaPaperPlane } from 'react-icons/fa6';
import { getChatMessageDirection } from '../../features/whatsappChat/whatsappChatAPI.js';
import { deliveryTicks, formatMessageClock, groupMessagesByDate, highlightText } from './chatUtils.jsx';

function MessageBody({ message, searchQuery }) {
  const type = message.type || 'text';
  const q = searchQuery || '';

  if (type === 'system') {
    return <div>{highlightText(message.message || 'System message', q)}</div>;
  }

  if (type === 'image') {
    return (
      <>
        {message.mediaUrl ? (
          <a href={message.mediaUrl} target="_blank" rel="noreferrer">
            <img className="wa-media" src={message.mediaUrl} alt="Image" />
          </a>
        ) : null}
        {message.message ? <div>{highlightText(message.message, q)}</div> : null}
      </>
    );
  }

  if (type === 'video') {
    return (
      <>
        {message.mediaUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video className="wa-media video" src={message.mediaUrl} controls />
        ) : (
          <div>Video</div>
        )}
        {message.message ? <div>{highlightText(message.message, q)}</div> : null}
      </>
    );
  }

  if (type === 'document' || type === 'file') {
    return (
      <a
        className="wa-doc-link"
        href={message.mediaUrl || '#'}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (!message.mediaUrl) e.preventDefault();
        }}
      >
        <FaPaperclip aria-hidden />
        {highlightText(message.fileName || message.message || 'Document', q)}
      </a>
    );
  }

  if (type === 'voice' || type === 'audio') {
    return message.mediaUrl ? (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <audio controls src={message.mediaUrl} style={{ maxWidth: '100%' }} />
    ) : (
      <div>Voice note</div>
    );
  }

  if (type === 'location') {
    const lat = message.latitude;
    const lng = message.longitude;
    const mapsUrl =
      lat != null && lng != null
        ? `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`
        : message.mediaUrl || '';
    return mapsUrl ? (
      <a className="wa-loc-link" href={mapsUrl} target="_blank" rel="noreferrer">
        📍 Location
      </a>
    ) : (
      <div>Location</div>
    );
  }

  if (type === 'sticker') {
    return message.mediaUrl ? (
      <img className="wa-media" src={message.mediaUrl} alt="Sticker" style={{ maxWidth: 140 }} />
    ) : (
      <div>Sticker</div>
    );
  }

  return <div>{highlightText(message.message || '', q)}</div>;
}

export function ChatMessageBubble({
  message,
  searchQuery,
  isActiveMatch,
  messageRef,
  ourNumber = '',
}) {
  const isSystem = message.type === 'system';
  const direction = isSystem ? 'incoming' : getChatMessageDirection(message, ourNumber);
  const ticks = direction === 'outgoing' && !isSystem ? deliveryTicks(message.status) : null;

  if (isSystem) {
    return (
      <div className="wa-bubble-row" style={{ justifyContent: 'center' }}>
        <div
          ref={messageRef}
          className={`wa-bubble is-system${isActiveMatch ? ' is-match-active' : ''}`}
          data-message-id={message.id}
        >
          <MessageBody message={message} searchQuery={searchQuery} />
        </div>
      </div>
    );
  }

  return (
    <div className={`wa-bubble-row ${direction}`}>
      <div
        ref={messageRef}
        className={`wa-bubble${message.unread ? ' is-unread' : ''}${isActiveMatch ? ' is-match-active' : ''}`}
        data-message-id={message.id}
      >
        <MessageBody message={message} searchQuery={searchQuery} />
        <div className="wa-bubble-meta">
          <span>{formatMessageClock(message.timestamp)}</span>
          {ticks?.kind === 'icon' ? (
            <span className={ticks.className} title={ticks.title} aria-label={ticks.title}>
              <FaClock aria-hidden />
            </span>
          ) : null}
          {ticks?.kind === 'ticks' && ticks.text ? (
            <span className={ticks.className} title={ticks.title}>
              {ticks.text}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ChatMessageList({
  messages,
  searchQuery,
  activeMatchId,
  messageRefs,
  listRef,
  onScroll,
  loadingOlder,
  hasMore,
  ourNumber = '',
  children,
}) {
  const groups = groupMessagesByDate(messages);

  return (
    <div className="wa-messages" ref={listRef} onScroll={onScroll}>
      {loadingOlder ? <div className="wa-load-older">Loading older messages…</div> : null}
      {!loadingOlder && hasMore ? (
        <div className="wa-load-older">Scroll up for older messages</div>
      ) : null}
      {groups.map((group) => (
        <div key={group.key}>
          <div className="wa-date-sep">{group.label}</div>
          {group.messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              searchQuery={searchQuery}
              isActiveMatch={activeMatchId === msg.id}
              ourNumber={ourNumber}
              messageRef={(el) => {
                if (messageRefs) messageRefs.current[msg.id] = el;
              }}
            />
          ))}
        </div>
      ))}
      {children}
    </div>
  );
}

export { FaMagnifyingGlass, FaPaperclip, FaFaceSmile, FaPaperPlane };
