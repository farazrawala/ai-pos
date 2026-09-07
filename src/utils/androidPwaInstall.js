import { isInstalledAppDisplay } from '../config/appBase.js';

/** Matches Bootstrap `xl` / sidenav desktop breakpoint. */
export const ANDROID_INSTALL_MOBILE_MAX_PX = 1199.98;

let deferredPrompt = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(deferredPrompt);
    } catch {
      /* ignore */
    }
  });
}

function capturePrompt(event) {
  event.preventDefault();
  deferredPrompt = event;
  notify();
}

function clearPrompt() {
  deferredPrompt = null;
  notify();
}

export function isAndroidChrome(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
) {
  const ua = String(userAgent || '');
  if (!/Android/i.test(ua)) return false;
  if (/\bwv\b|; wv\)/i.test(ua)) return false;
  if (
    /\bEdgA?\//.test(ua) ||
    /\bOPR\//.test(ua) ||
    /\bSamsungBrowser\//.test(ua) ||
    /\bFirefox\//.test(ua)
  ) {
    return false;
  }
  return /\bChrome\//.test(ua);
}

export function isMobileViewport(
  width = typeof window !== 'undefined' ? window.innerWidth : ANDROID_INSTALL_MOBILE_MAX_PX + 1
) {
  return width <= ANDROID_INSTALL_MOBILE_MAX_PX;
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function subscribeAndroidInstallPrompt(listener) {
  listeners.add(listener);
  listener(deferredPrompt);
  return () => listeners.delete(listener);
}

export async function promptAndroidInstall() {
  if (!deferredPrompt || typeof deferredPrompt.prompt !== 'function') {
    return { outcome: 'unavailable' };
  }
  const event = deferredPrompt;
  deferredPrompt = null;
  notify();
  event.prompt();
  try {
    return (await event.userChoice) || { outcome: 'dismissed' };
  } catch {
    return { outcome: 'dismissed' };
  }
}

export function shouldShowAndroidInstallButton(prompt = deferredPrompt) {
  if (!prompt) return false;
  if (isInstalledAppDisplay()) return false;
  if (!isAndroidChrome()) return false;
  if (!isMobileViewport()) return false;
  return true;
}

export function initAndroidInstallPromptCapture() {
  if (typeof window === 'undefined' || window.__aiPosInstallPromptBound) return;
  window.__aiPosInstallPromptBound = true;
  if (window.__aiPosDeferredInstallPrompt) {
    deferredPrompt = window.__aiPosDeferredInstallPrompt;
  }
  window.addEventListener('beforeinstallprompt', capturePrompt);
  window.addEventListener('appinstalled', clearPrompt);
}

initAndroidInstallPromptCapture();
