export function ContactListSkeleton({ rows = 6 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="wa-skeleton-row">
          <div className="wa-skel wa-skel-avatar" />
          <div className="wa-skel-lines">
            <div className="wa-skel wa-skel-line" />
            <div className="wa-skel wa-skel-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatMessagesSkeleton() {
  return (
    <div className="wa-messages" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`wa-bubble-row ${i % 2 === 0 ? 'outgoing' : 'incoming'}`}
        >
          <div
            className="wa-skel"
            style={{
              height: 40 + (i % 3) * 12,
              width: `${40 + i * 8}%`,
              maxWidth: 280,
              borderRadius: 8,
            }}
          />
        </div>
      ))}
    </div>
  );
}
