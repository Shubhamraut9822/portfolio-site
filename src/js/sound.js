/**
 * Two small interaction sounds, synthesised with the Web Audio API so there is
 * no asset to load. Muted by default, always. The audio context is not even
 * created until the visitor taps the toggle, which also satisfies the browser
 * requirement that audio begins from a real user gesture.
 */

const state = {
  ctx: null,
  enabled: false,
  master: null,
};

function ensureContext() {
  if (state.ctx) return state.ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  state.ctx = new AudioCtx();
  state.master = state.ctx.createGain();
  state.master.gain.value = 1;
  state.master.connect(state.ctx.destination);
  return state.ctx;
}

/** One short enveloped oscillator. Everything here is built from this. */
function tone({ freq, endFreq, duration, gain, type = 'sine', delay = 0 }) {
  const ctx = state.ctx;
  if (!ctx) return;

  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

  // Quick attack, exponential tail. Never a click on start or stop.
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(env);
  env.connect(state.master);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

/** Soft low chime, played the moment a framework ring locks into orbit. */
export function playRingLock() {
  if (!state.enabled || !state.ctx) return;
  if (state.ctx.state === 'suspended') state.ctx.resume();

  tone({ freq: 174.6, endFreq: 130.8, duration: 0.42, gain: 0.18, type: 'sine' });
  // A fifth above, quieter and slightly late, gives it a bell like body.
  tone({ freq: 261.6, endFreq: 196, duration: 0.3, gain: 0.06, type: 'sine', delay: 0.02 });
}

/** Very faint tick, paired with the coral click ripple. */
export function playClickTick() {
  if (!state.enabled || !state.ctx) return;
  if (state.ctx.state === 'suspended') state.ctx.resume();

  tone({ freq: 1180, endFreq: 760, duration: 0.045, gain: 0.1, type: 'triangle' });
}

export function isSoundOn() {
  return state.enabled;
}

const ICON_MUTED = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 9v6h4l5 4V5L8 9H4z"/>
    <path d="M17 9.5l4 5M21 9.5l-4 5"/>
  </svg>`;

const ICON_ON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 9v6h4l5 4V5L8 9H4z"/>
    <path d="M17 9.2a4 4 0 0 1 0 5.6"/>
    <path d="M19.6 6.6a7.6 7.6 0 0 1 0 10.8"/>
  </svg>`;

export function initSound() {
  const btn = document.querySelector('[data-sound-toggle]');
  if (!btn) return;

  const paint = () => {
    btn.innerHTML = state.enabled ? ICON_ON : ICON_MUTED;
    btn.setAttribute('aria-pressed', String(state.enabled));
    btn.setAttribute('aria-label', state.enabled ? 'Turn interaction sounds off' : 'Turn interaction sounds on');
    btn.classList.toggle('is-on', state.enabled);
  };

  paint();

  btn.addEventListener('click', () => {
    if (!state.enabled) {
      // First tap is the user gesture that lets us build the context at all.
      if (!ensureContext()) return;
      state.enabled = true;
      paint();
      playClickTick();
    } else {
      state.enabled = false;
      paint();
    }
  });
}
