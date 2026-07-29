export default function TicketEmptyState({
  title = 'No tickets yet',
  description = 'When you create a support ticket, it will show up here.',
  action = null,
}) {
  return (
    <div className="support-empty text-center py-5 px-3">
      <div className="support-empty__illustration mb-3" aria-hidden>
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="18" width="80" height="64" rx="10" fill="#e9ecef" />
          <rect x="32" y="32" width="40" height="6" rx="3" fill="#adb5bd" />
          <rect x="32" y="44" width="56" height="5" rx="2.5" fill="#ced4da" />
          <rect x="32" y="54" width="48" height="5" rx="2.5" fill="#ced4da" />
          <circle cx="88" cy="72" r="16" fill="#5e72e4" opacity="0.9" />
          <path d="M88 64v10M83 74h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <h6 className="mb-1">{title}</h6>
      <p className="text-muted text-sm mb-3">{description}</p>
      {action}
    </div>
  );
}
