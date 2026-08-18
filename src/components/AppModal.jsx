import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  acquireBodyScrollLock,
  releaseBodyScrollLock,
} from '../utils/bodyScrollLock.js';

const SIZE_CLASS = {
  sm: 'app-modal-dialog--sm',
  md: '',
  lg: 'app-modal-dialog--lg',
  xl: 'app-modal-dialog--xl',
  full: 'app-modal-dialog--full',
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
  const titleId = ariaLabelledBy || 'app-modal-title';

  useEffect(() => {
    if (!open) return undefined;

    acquireBodyScrollLock();

    const onKeyDownCapture = (e) => {
      if (e.key !== 'Escape') return;
      const roots = document.querySelectorAll('body > .app-modal-root');
      if (roots.length === 0) return;
      const topRoot = roots[roots.length - 1];
      // Only the topmost nested modal should close on Escape.
      if (!topRoot.querySelector(`#${CSS.escape(titleId)}`)) return;
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    };

    window.addEventListener('keydown', onKeyDownCapture, true);

    return () => {
      releaseBodyScrollLock();
      window.removeEventListener('keydown', onKeyDownCapture, true);
    };
  }, [open, onClose, titleId]);

  if (!open || typeof document === 'undefined') return null;

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
