function TimelineItem({ event }) {
  const border =
    event.type === 'payment'
      ? 'border-success'
      : event.type === 'invoice'
        ? 'border-primary'
        : event.type === 'adjustment'
          ? 'border-warning'
          : 'border-info';
  return (
    <div
      className={`border-start ${border} ps-3 ms-1 mb-4`}
      style={{ borderLeftWidth: 3, borderLeftStyle: 'solid' }}
    >
      <small className="text-muted d-block">{event.at}</small>
      <p className="text-sm font-weight-bold mb-1 mb-0">{event.title}</p>
      <p className="text-sm text-secondary mb-1">{event.detail}</p>
      <span className="text-xs text-muted">by {event.by}</span>
    </div>
  );
}

export default function LedgerActivityTimeline({ events, hasMore = false, onAddMore, totalMatching }) {
  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-header pb-0 bg-transparent">
        <h6 className="mb-0">Recent activity timeline</h6>
        <p className="text-xs text-muted mb-0">
          {events.length > 0 && typeof totalMatching === 'number'
            ? `Showing ${events.length} of ${totalMatching} — same filters as the ledger table`
            : 'Same filters as the ledger table'}
        </p>
      </div>
      <div className="card-body pt-3">
        {events.length === 0 ? (
          <div className="text-center py-4 text-muted">
            <i className="ni ni-time-alarm text-lg opacity-3 d-block mb-2" style={{ fontSize: '2rem' }} />
            <p className="text-sm font-weight-bold mb-1">No activity in this view</p>
            <p className="text-xs mb-0">Load transactions or widen date / filter criteria.</p>
          </div>
        ) : (
          <>
            {events.map((e) => (
              <TimelineItem key={e.id} event={e} />
            ))}
            {hasMore && onAddMore ? (
              <div className="border-top pt-3 mt-1 text-center">
                <button type="button" className="btn btn-sm btn-outline-primary mb-0" onClick={onAddMore}>
                  <i className="ni ni-bold-down me-1" />
                  Add more
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
