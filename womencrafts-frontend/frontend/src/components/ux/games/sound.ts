/**
 * Soft sounds for the calm games — made in the browser, never downloaded.
 *
 * One AudioContext for the page, opened on the first sound (browsers only
 * allow audio after a tap). Every tone fades in and out so nothing clicks.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A gentle sine tone. */
export function tone(freq: number, seconds = 0.9, volume = 0.06) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + seconds + 0.05);
}

/** A tiny, soft "pop" — a quick falling tone. */
export function pop() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(720 + Math.random() * 240, t);
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.12);
  gain.gain.setValueAtTime(0.07, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.16);
}

/** A light buzz on phones that have one. */
export function buzz(ms = 30) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}
