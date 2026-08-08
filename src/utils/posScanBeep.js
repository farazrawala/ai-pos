/** POS barcode scan feedback (Web Audio — no asset files). */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/** Call from a click/keydown so the browser allows sound. */
export function unlockPosScanAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function tone(ctx, startAt, freq, duration, type = 'sine', gainValue = 0.16) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/**
 * @param {'success' | 'error'} kind
 */
export function playPosScanBeep(kind = 'success') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    if (kind === 'error') {
      tone(ctx, now, 220, 0.16, 'square', 0.1);
      tone(ctx, now + 0.12, 160, 0.2, 'square', 0.1);
      return;
    }
    tone(ctx, now, 980, 0.07, 'sine', 0.18);
    tone(ctx, now + 0.08, 1320, 0.1, 'sine', 0.16);
  } catch {
    /* autoplay / unsupported */
  }
}
