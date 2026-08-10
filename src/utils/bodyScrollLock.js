/** Reference-counted body scroll lock for stacked modals/overlays. */

let lockCount = 0;
let savedInlineOverflow = '';

export function acquireBodyScrollLock() {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    savedInlineOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

export function releaseBodyScrollLock() {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = savedInlineOverflow;
    savedInlineOverflow = '';
  }
}

/** Clear a stuck lock (e.g. after a prior nested-modal bug). Safe when no locks are held. */
export function resetBodyScrollLockIfIdle() {
  if (typeof document === 'undefined') return;
  if (lockCount > 0) return;
  if (document.body.style.overflow === 'hidden') {
    document.body.style.overflow = '';
  }
}
