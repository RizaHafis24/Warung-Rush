// Warung Rush — audio.js
// All sound is synthesized with the Web Audio API: no audio files, no
// network, nothing to load. The context is created lazily on the first
// player gesture, so browsers never block it.

let ctx = null;
let muted = false;

// Throttle: browsers crackle when too many oscillators pile up in one
// frame (a rush can fire several cues at once), so drop the extras.
const recentBlips = [];
function throttleOk() {
  const now = performance.now();
  while (recentBlips.length && recentBlips[0] < now - 200) recentBlips.shift();
  if (recentBlips.length >= 30) return false;
  recentBlips.push(now);
  return true;
}

function ensureCtx() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

// One short oscillator blip: the building block for every cue.
function blip(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
  if (muted || !throttleOk()) return;
  const ac = ensureCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// A burst of filtered noise: the sizzle of the wok, the chop thwack.
function noiseBurst(dur, filterFreq, vol = 0.15, delay = 0) {
  if (muted) return;
  const ac = ensureCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  // Player picks an ingredient off the counter.
  pick() { blip(520, 0.07, 'triangle', 0.1, 660); },
  // Ingredient lands in the pan.
  drop() { blip(300, 0.08, 'triangle', 0.12, 210); noiseBurst(0.05, 1200, 0.05); },
  // Pan cleared / ingredient removed.
  undo() { blip(420, 0.08, 'triangle', 0.08, 280); },
  // Cooking starts: a sizzle that says the wok is hot.
  cook() { noiseBurst(0.5, 3200, 0.14); blip(180, 0.25, 'sawtooth', 0.05, 120); },
  // Dish finished cooking.
  ready() { blip(880, 0.12, 'sine', 0.12); blip(1318, 0.18, 'sine', 0.12, null, 0.1); },
  // Plate served: the till ding plus coins.
  serve() {
    blip(1046, 0.1, 'sine', 0.12);
    blip(1318, 0.14, 'sine', 0.12, null, 0.08);
    blip(1568, 0.2, 'sine', 0.1, null, 0.16);
  },
  // Wrong ticket, wrong station, or a full plate.
  error() { blip(220, 0.16, 'sawtooth', 0.09, 140); },
  // New order pinned to the board.
  order() { blip(660, 0.08, 'square', 0.06, 880); blip(880, 0.1, 'square', 0.05, null, 0.07); },
  // An order expired: a customer walks away angry.
  miss() { blip(330, 0.3, 'sawtooth', 0.1, 110); },
  // Low tick while an order's last 10 seconds run out.
  tick() { blip(1250, 0.05, 'square', 0.045); },
  // Rush phase banner.
  rush() {
    blip(392, 0.12, 'square', 0.08);
    blip(523, 0.12, 'square', 0.08, null, 0.1);
    blip(659, 0.2, 'square', 0.09, null, 0.2);
  },
  // Shift over.
  over() {
    blip(523, 0.18, 'triangle', 0.1);
    blip(392, 0.18, 'triangle', 0.1, null, 0.16);
    blip(330, 0.3, 'triangle', 0.1, null, 0.32);
  },
  // UI click on title / restart.
  click() { blip(700, 0.05, 'triangle', 0.08); },
};

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}
