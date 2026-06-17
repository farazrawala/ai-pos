import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-screen overlay for maximized test-case panels. Portals to document.body so
 * fixed positioning is not clipped and z-index stacks above the app sidebar.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   ariaLabel: string;
 *   maxWidthClass?: string;
 *   children: import('react').ReactNode;
 * }} props
 */
export default function MaximizedPanelOverlay({
  open,
  onClose,
  ariaLabel,
  maxWidthClass = 'max-w-5xl',
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="tc-maximized-overlay flex flex-col bg-slate-900/50 p-3 sm:p-6"
      style={{ zIndex: 10050 }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <div
        className={`mx-auto flex h-full w-full ${maxWidthClass} flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
