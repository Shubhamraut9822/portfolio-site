import '../styles/main.css';

import gsap from 'gsap';
import { createLoader } from './loader.js';
import { initUI } from './ui.js';
import { initCursor } from './cursor.js';
import { initGlyphs } from './glyphs.js';
import { initScroll } from './scroll.js';

const MOBILE_BREAKPOINT = 768;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth < MOBILE_BREAKPOINT;

if (reducedMotion) document.documentElement.classList.add('is-static');

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

async function boot() {
  const mobile = isMobile();

  // The loader is the first thing that should be visible, so lift the page
  // curtain before anything waits on fonts.
  document.body.classList.add('is-ready');

  const loader = createLoader({ reducedMotion, isMobile: mobile });

  loader.set(0.12);

  // Fonts matter here: the ring labels are rasterised to a canvas texture, so
  // the scene must not build before JetBrains Mono is available.
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fall through, the fallback monospace is acceptable */
    }
  }
  loader.set(0.45);

  initUI({ reducedMotion });

  let scene = null;
  const canvas = document.querySelector('[data-scene]');

  if (canvas) {
    if (!mobile && supportsWebGL()) {
      const { createScene } = await import('./scene.js');
      scene = createScene({ canvas });
    } else {
      canvas.remove();
    }
  }

  loader.set(0.8);

  const cursor = initCursor({
    reducedMotion,
    onMove: (nx, ny) => scene && scene.setPointer(nx, ny),
  });

  initGlyphs({ reducedMotion, isMobile: mobile });

  const { heroTimeline } = initScroll({ scene, reducedMotion, isMobile: mobile });

  // ------------------------------------------------------ single render loop
  if (scene) {
    // Everything three.js and GSAP related shares this one ticker. No
    // competing requestAnimationFrame loops anywhere in the project.
    if (!reducedMotion) {
      let last = performance.now();
      let paused = false;

      const tick = () => {
        if (paused) return;
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        scene.render(dt);
      };

      gsap.ticker.add(tick);

      document.addEventListener('visibilitychange', () => {
        paused = document.hidden;
        last = performance.now();
        gsap.ticker[paused ? 'sleep' : 'wake']();
      });
    }

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (isMobile()) return;
        scene.resize();
        if (reducedMotion) scene.assembleInstantly();
      }, 160);
    });

    window.addEventListener('beforeunload', () => scene.dispose(), { once: true });
  }

  loader.set(1);

  // ------------------------------------------------------------- curtain up
  if (reducedMotion) {
    if (scene) scene.assembleInstantly();
    if (cursor.refresh) cursor.refresh();
    return;
  }

  await loader.finish();

  if (scene && heroTimeline) {
    scene.heroEntrance({ onFlash: () => heroTimeline.play() });
  } else if (heroTimeline) {
    // No 3D here: the copy still arrives with the same rhythm, just unaccompanied.
    gsap.delayedCall(0.25, () => heroTimeline.play());
  }

  if (cursor.refresh) cursor.refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
