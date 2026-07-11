/**
 * Shared loading/retry UI shown while a list (or other) fetch failed and is auto-retrying.
 */
export default function FetchRetryStatus({
  countdown = null,
  message = 'we are trying to load please wait.',
  className = '',
}) {
  const retryLabel =
    countdown != null && countdown > 0 ? `Retrying in ${countdown}…` : 'Retrying…';

  return (
    <div
      className={`text-center py-5 px-3 ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading…</span>
      </div>
      <p className="text-sm text-muted mt-3 mb-1">{message}</p>
      <p className="text-sm text-secondary mb-0">{retryLabel}</p>
    </div>
  );
}
