import AppModal from '../AppModal.jsx';

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onClose,
}) {
  const btnClass =
    variant === 'danger' ? 'btn-danger' : variant === 'warning' ? 'btn-warning' : 'btn-primary';

  return (
    <AppModal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      disableBackdropClose={loading}
      footer={
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn btn-sm ${btnClass} mb-0`} onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                Please wait…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </>
      }
    >
      <p className="mb-0 text-sm">{message}</p>
    </AppModal>
  );
}
