import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const SIZE_CLASS = {
  sm: 'app-modal-dialog--sm',
  md: '',
  lg: 'app-modal-dialog--lg',
  xl: 'app-modal-dialog--xl',
};

/**
 * Full-viewport modal rendered via portal — sits above Argon sidenav (z-index 9999).
 */
export default function AppModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  disableBackdropClose = false,
  ariaLabelledBy,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const titleId = ariaLabelledBy || 'app-modal-title';

  return createPortal(
    <div className="app-modal-root" role="presentation">
      <div
        className="app-modal-backdrop"
        onClick={disableBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        className={`app-modal-dialog ${SIZE_CLASS[size] || ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="app-modal-content">
          {(title || subtitle) && (
            <div className="app-modal-header">
              <div className="app-modal-header-text">
                {title ? (
                  <h5 className="app-modal-title" id={titleId}>
                    {title}
                  </h5>
                ) : null}
                {subtitle ? <p className="app-modal-subtitle mb-0">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                className="app-modal-close btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
          )}
          <div className="app-modal-body">{children}</div>
          {footer ? <div className="app-modal-footer">{footer}</div> : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
