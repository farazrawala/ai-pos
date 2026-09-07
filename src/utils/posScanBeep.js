/** POS barcode scan feedback (Web Audio + HTML Audio — no asset files). */

let audioCtx = null;
let htmlBeeps = null;
let htmlUnlocked = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** Full-scale square-wave WAV so mobile HTMLAudio can play at volume 1. */
function makeBeepWavUrl({ freq, durationMs, sampleRate = 22050 }) {
  const samples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const dataBytes = samples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const duration = samples / sampleRate;
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.008);
    const release = Math.min(1, (duration - t) / 0.02);
    const env = Math.max(0, Math.min(attack, release));
    const square = Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1;
    view.setInt16(44 + i * 2, Math.round(square * env * 32767), true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function getHtmlBeeps() {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (htmlBeeps) return htmlBeeps;
  const make = (url) => {
    const el = new Audio(url);
    el.preload = 'auto';
    el.volume = 1;
    el.playsInline = true;
    return el;
  };
  htmlBeeps = {
    success: make(makeBeepWavUrl({ freq: 1950, durationMs: 180 })),
    error: make(makeBeepWavUrl({ freq: 280, durationMs: 260 })),
  };
  return htmlBeeps;
}

function playHtmlBeep(kind) {
  const beeps = getHtmlBeeps();
  if (!beeps) return false;
  const el = kind === 'error' ? beeps.error : beeps.success;
  try {
    el.pause();
    el.currentTime = 0;
    el.volume = 1;
    el.muted = false;
    const play = el.play();
    if (play && typeof play.catch === 'function') play.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Call from a click/keydown so the browser allows sound later (camera callbacks are not gestures). */
export function unlockPosScanAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (ctx) {
    try {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }
  const beeps = getHtmlBeeps();
  if (!beeps || htmlUnlocked) return;
  const warm = beeps.success;
  const finish = () => {
    try {
      warm.pause();
      warm.currentTime = 0;
      warm.muted = false;
      warm.volume = 1;
    } catch {
      /* ignore */
    }
    htmlUnlocked = true;
  };
  try {
    warm.muted = true;
    warm.volume = 1;
    const play = warm.play();
    if (play && typeof play.then === 'function') {
      play.then(finish).catch(() => {
        warm.muted = false;
      });
    } else {
      finish();
    }
  } catch {
    warm.muted = false;
  }
}

function tone(ctx, startAt, freq, duration, type = 'square', gainValue = 1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function playTones(ctx, kind) {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (kind === 'error') {
    tone(ctx, now, 420, 0.16, 'square', 1);
    tone(ctx, now + 0.12, 260, 0.22, 'square', 1);
    return;
  }
  // Classic POS scanner chirp at full software volume.
  tone(ctx, now, 1650, 0.09, 'square', 1);
  tone(ctx, now + 0.05, 2200, 0.14, 'square', 1);
}

/**
 * @param {'success' | 'error'} kind
 */
export function playPosScanBeep(kind = 'success') {
  try {
    const ctx = getAudioContext();
    if (ctx?.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    playHtmlBeep(kind);
    if (!ctx) return;
    if (ctx.state === 'running') {
      playTones(ctx, kind);
      return;
    }
    ctx.resume().then(() => playTones(ctx, kind)).catch(() => {});
  } catch {
    /* autoplay / unsupported */
  }
}
