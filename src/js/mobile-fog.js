import gsap from 'gsap';

/**
 * Ambient fog and embers for mobile, site wide.
 *
 * A deliberately lightweight canvas 2D system, not three.js. It echoes the
 * character of the desktop ember field without any of the cost. Tilting the
 * phone nudges the drift, which is the mobile counterpart of the pointer
 * disturbing the fog on desktop.
 *
 * It shares the one gsap.ticker with everything else rather than starting a
 * competing requestAnimationFrame loop.
 */

const COUNT = 52;
const OFF_WHITE = '247, 245, 241';
const CORAL = '255, 84, 54';

export function initMobileFog({ reducedMotion = false } = {}) {
  if (reducedMotion) return null;
  if (window.innerWidth >= 768) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'mobile-fog';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return null;
  }

  let w = 0;
  let h = 0;
  let dpr = 1;
  const particles = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    particles.length = 0;
    for (let i = 0; i < COUNT; i += 1) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1.1 + Math.random() * 2.6,
        // Calm and aimless, mostly drifting upward like incense in still air.
        vx: (Math.random() - 0.5) * 0.12,
        vy: -(0.05 + Math.random() * 0.16),
        a: 0.16 + Math.random() * 0.34,
        warm: Math.random() < 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  resize();
  seed();

  // ------------------------------------------------------------- tilt input
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };

  function onOrientation(e) {
    // gamma is left to right, beta is front to back. Both in degrees.
    if (e.gamma == null && e.beta == null) return;
    tilt.tx = Math.max(-1, Math.min(1, (e.gamma || 0) / 45));
    tilt.ty = Math.max(-1, Math.min(1, ((e.beta || 0) - 45) / 45));
  }

  function attachOrientation() {
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }

  const NeedsPermission =
    typeof window.DeviceOrientationEvent !== 'undefined' &&
    typeof window.DeviceOrientationEvent.requestPermission === 'function';

  if (NeedsPermission) {
    // iOS: the request must come from a real tap, so offer one, once.
    showMotionPrompt(attachOrientation);
  } else if (typeof window.DeviceOrientationEvent !== 'undefined') {
    attachOrientation();
  }
  // If neither path applies the particles simply keep their autonomous drift.

  // ------------------------------------------------------------------ loop
  let clock = 0;
  let paused = document.hidden;

  function frame() {
    if (paused) return;

    clock += 1 / 60;
    tilt.x += (tilt.tx - tilt.x) * 0.05;
    tilt.y += (tilt.ty - tilt.y) * 0.05;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];

      p.x += p.vx + Math.sin(clock * 0.3 + p.phase) * 0.08 + tilt.x * 0.5;
      p.y += p.vy + tilt.y * 0.35;

      if (p.y < -12) {
        p.y = h + 12;
        p.x = Math.random() * w;
      }
      if (p.y > h + 12) p.y = -12;
      if (p.x < -12) p.x = w + 12;
      if (p.x > w + 12) p.x = -12;

      const rgb = p.warm ? CORAL : OFF_WHITE;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.2);
      g.addColorStop(0, `rgba(${rgb}, ${p.a})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  gsap.ticker.add(frame);

  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      seed();
    }, 180);
  });

  return {
    destroy() {
      gsap.ticker.remove(frame);
      window.removeEventListener('deviceorientation', onOrientation);
      canvas.remove();
    },
  };
}

/**
 * A small dismissible pill. Only ever shown where the platform actually
 * requires an explicit motion permission, which in practice means iOS.
 */
function showMotionPrompt(onGranted) {
  if (sessionStorage.getItem('motion-prompt-seen') === '1') return;

  const pill = document.createElement('div');
  pill.className = 'motion-pill';
  pill.innerHTML = `
    <button type="button" data-motion-allow>Enable motion</button>
    <button type="button" data-motion-dismiss aria-label="Dismiss">&times;</button>
  `;
  document.body.appendChild(pill);

  requestAnimationFrame(() => pill.classList.add('is-in'));

  const close = () => {
    sessionStorage.setItem('motion-prompt-seen', '1');
    pill.classList.remove('is-in');
    window.setTimeout(() => pill.remove(), 400);
  };

  pill.querySelector('[data-motion-allow]').addEventListener('click', async () => {
    try {
      const res = await window.DeviceOrientationEvent.requestPermission();
      if (res === 'granted') onGranted();
    } catch {
      // Denied, or the call threw. Either way the drift carries on unchanged.
    }
    close();
  });

  pill.querySelector('[data-motion-dismiss]').addEventListener('click', close);
  window.setTimeout(close, 12000);
}
