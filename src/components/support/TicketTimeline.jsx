import { useCallback, useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble.jsx';

/**
 * Conversation timeline with auto-scroll, infinite scroll upward, and typing placeholder.
 */
export default function TicketTimeline({
  messages = [],
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  typing = false,
  onPreviewImage,
  currentUserId = '',
  viewerIsAdmin = false,
  emptyLabel = 'No messages yet. Start the conversation below.',
}) {
  const scrollerRef = useRef(null);
  const bottomRef = useRef(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  useEffect(() => {
    if (stickToBottom) scrollToBottom(true);
  }, [messages.length, typing, stickToBottom, scrollToBottom]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setStickToBottom(nearBottom);
    if (el.scrollTop < 48 && hasMore && !loadingMore && typeof onLoadMore === 'function') {
      const prevHeight = el.scrollHeight;
      Promise.resolve(onLoadMore()).then(() => {
        requestAnimationFrame(() => {
          if (scrollerRef.current) {
            scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  };

  if (loading) {
    return (
      <div className="support-timeline support-timeline--skeleton">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`support-skeleton-bubble ${i % 2 === 0 ? 'is-right' : ''}`}>
            <div className="support-skeleton support-skeleton--avatar" />
            <div className="flex-grow-1">
              <div className="support-skeleton support-skeleton--line w-25 mb-2" />
              <div className="support-skeleton support-skeleton--line w-75 mb-1" />
              <div className="support-skeleton support-skeleton--line w-50" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="support-conversation-panel">
      <div className="support-timeline" ref={scrollerRef} onScroll={onScroll} role="log" aria-live="polite">
        {loadingMore ? (
          <div className="text-center py-2">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Loading older messages…</span>
            </div>
          </div>
        ) : null}

        {hasMore && !loadingMore ? (
          <div className="text-center pb-2">
            <button type="button" className="btn btn-link btn-sm text-secondary mb-0" onClick={onLoadMore}>
              Load earlier messages
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="support-empty text-center py-5 px-3">
            <div className="support-empty__illustration mb-3" aria-hidden>
              <svg width="88" height="72" viewBox="0 0 88 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="12" width="52" height="36" rx="10" fill="#e9ecef" />
                <rect x="18" y="22" width="28" height="5" rx="2.5" fill="#adb5bd" />
                <rect x="18" y="32" width="36" height="4" rx="2" fill="#ced4da" />
                <rect x="28" y="28" width="52" height="32" rx="10" fill="#5e72e4" opacity="0.85" />
                <rect x="38" y="38" width="28" height="5" rx="2.5" fill="#fff" opacity="0.9" />
                <rect x="38" y="48" width="20" height="4" rx="2" fill="#fff" opacity="0.65" />
              </svg>
            </div>
            <p className="text-muted mb-0 text-sm">{emptyLabel}</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble
              key={msg._id || msg.id || `msg-${idx}`}
              message={msg}
              onPreviewImage={onPreviewImage}
              currentUserId={currentUserId}
              viewerIsAdmin={viewerIsAdmin}
            />
          ))
        )}

        {typing ? (
          <div className="support-typing" aria-label="Someone is typing">
            <span />
            <span />
            <span />
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
