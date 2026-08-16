/**
 * Environment probes shared by every module.
 * Kept in one place so "is this device allowed to run the heavy stuff?" has a
 * single answer across the 3D scene, the parallax stage and the cursor.
 */

export const MOBILE_BREAKPOINT = 768;

/**
 * The 3D scene needs a viewport wide enough to hold the copy column *and* the
 * structure side by side. Below this they overlap and both suffer, so narrower
 * screens get the CSS hero mark instead. Keep in sync with the `.webgl` and
 * `.hero__mark` rules in main.css.
 */
export const WEBGL_BREAKPOINT = 1100;

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/** True when the viewport is in the mobile layout. */
export const isMobile = () => window.innerWidth < MOBILE_BREAKPOINT;

/** True when the viewport is wide enough for the 3D structure to be worth it. */
export const canRender3D = () => window.innerWidth >= WEBGL_BREAKPOINT;

/** True when the user has asked the OS to tone motion down. */
export const prefersReducedMotion = () => reducedMotionQuery.matches;

/** Pointer-based devices only — no custom cursor on touch. */
export const hasFinePointer = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** WebGL availability check so a failed context never throws at boot. */
export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

/** Debounced resize helper used by the renderer and the parallax stage. */
export function onResize(handler, wait = 150) {
  let timer;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(handler, wait);
  };
  window.addEventListener('resize', run, { passive: true });
  return () => window.removeEventListener('resize', run);
}
