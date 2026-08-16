/**
 * Entry point, shared by all six pages.
 *
 * Boot order matters:
 *   1. Kick off the loading screen immediately, gated on a `ready` promise.
 *   2. Shared chrome (header, menu, page transitions): cheap, do it first.
 *   3. Smooth scroll, so every later measurement agrees on scroll position.
 *   4. The 3D scene: homepage + desktop only, and lazily imported so the other
 *      five pages never download Three.js at all.
 *   5. Scroll-driven animation, once the DOM and the scene both exist.
 *   6. Release the loader, then play the hero entrance.
 */
import '../styles/main.css';

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initLoader, showLoaderPulse } from './loader.js';
import { initCursor } from './cursor.js';
import { canRender3D, onResize, prefersReducedMotion, supportsWebGL } from './env.js';
import {
  initSmoothScroll,
  initDepthLayers,
  initSceneAssembly,
  initReveals,
  initCounters,
  initScrollCue,
  initTicker,
  playHeroEntrance,
} from './scroll-animations.js';
import {
  initHeader,
  initMobileMenu,
  initPageTransitions,
  initAccordion,
  initFilters,
  initInertForms,
} from './ui.js';

/* -------------------------------------------------------------------------- */
/* Loader gate: opened once boot() has finished                               */
/* -------------------------------------------------------------------------- */

let releaseReady;
const ready = new Promise((resolve) => {
  releaseReady = resolve;
});

// Starts the ~3s name animation right away; it will not dismiss until `ready`.
const loaderFinished = initLoader(ready);

// If boot outlives the loader choreography, show the "still working" pulse.
const pulseTimer = setTimeout(showLoaderPulse, 3000);
ready.then(() => clearTimeout(pulseTimer));

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Loads and starts the 3D scene, but only where it belongs: the homepage
 * (the only page with a `.webgl` canvas), on a viewport wide enough to warrant
 * it, on a device that can actually do WebGL.
 * @returns {Promise<object|null>}
 */
async function loadScene() {
  const canvas = document.querySelector('.webgl');
  if (!canvas || !canRender3D() || !supportsWebGL()) return null;

  try {
    const { initThreeScene } = await import('./three-scene.js');
    return initThreeScene();
  } catch (error) {
    // A missing GPU context must never take the rest of the page down with it.
    console.warn('3D scene unavailable, continuing without it.', error);
    return null;
  }
}

async function boot() {
  if (prefersReducedMotion()) document.documentElement.classList.add('no-motion');

  initHeader();
  initMobileMenu();
  initPageTransitions();
  initAccordion();
  initFilters();
  initInertForms();

  initSmoothScroll();

  const three = await loadScene();
  three?.setPointer(0, 0);

  // The pointer feed runs on every page; only the homepage has a scene to steer.
  initCursor((x, y) => three?.setPointer(x, y));

  initDepthLayers();
  initSceneAssembly(three);
  initReveals();
  initCounters();
  initScrollCue();
  initTicker();

  onResize(() => {
    three?.resize();
    ScrollTrigger.refresh();
  });

  // Layout settles once webfonts land, so refresh to put triggers on real numbers.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return three;
}

boot()
  .then((three) => {
    releaseReady();
    return loaderFinished.then(() => {
      playHeroEntrance(three);
      ScrollTrigger.refresh();
    });
  })
  .catch((error) => {
    // Whatever went wrong, never strand the visitor behind the loading screen.
    console.error(error);
    releaseReady();
  });
