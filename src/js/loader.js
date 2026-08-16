/**
 * Loading screen.
 *
 * Plays a ~3s letter-by-letter assembly of the name lockup while the rest of
 * the site (notably Three.js) initialises behind it. The screen is a real gate:
 * it will not dismiss until the `ready` promise resolves, and if that takes
 * longer than the animation a pulsing dot holds the frame.
 */
import { gsap } from 'gsap';
import { prefersReducedMotion } from './env.js';

const NAME = 'SHUBHAM RAUT';

function buildMarkup(loader) {
  const nameEl = loader.querySelector('.loader__name');
  if (!nameEl) return [];

  // Split into per-character spans so each one can be staggered independently.
  const chars = [...NAME].map((char) => {
    const span = document.createElement('span');
    span.className = 'loader__char';
    span.textContent = char === ' ' ? ' ' : char;
    span.setAttribute('aria-hidden', 'true');
    nameEl.appendChild(span);
    return span;
  });

  // Keep the accessible name intact for screen readers.
  nameEl.setAttribute('aria-label', NAME);
  nameEl.setAttribute('role', 'text');

  return chars;
}

/**
 * @param {Promise} ready Resolves when the rest of the site has finished booting.
 * @returns {Promise<void>} Resolves once the loader has left the DOM.
 */
export function initLoader(ready) {
  const loader = document.querySelector('.loader');
  document.body.classList.add('is-loading');

  const finish = () => {
    document.body.classList.remove('is-loading');
    loader?.remove();
  };

  if (!loader) {
    document.body.classList.remove('is-loading');
    return ready.catch(() => {});
  }

  const chars = buildMarkup(loader);
  const rule = loader.querySelector('.loader__rule');
  const sub = loader.querySelector('.loader__sub');
  const dot = loader.querySelector('.loader__dot');

  if (prefersReducedMotion()) {
    // Static lockup, dismissed as soon as the site is ready.
    gsap.set([...chars], { opacity: 1, y: 0 });
    gsap.set(rule, { width: 60 });
    gsap.set(sub, { opacity: 1 });
    return ready
      .catch(() => {})
      .then(() => new Promise((resolve) => setTimeout(() => { finish(); resolve(); }, 200)));
  }

  const readySettled = ready.catch(() => {});

  // ~2.9s of choreography: letters → hold → rule → subtitle → hold.
  const tl = gsap.timeline();

  tl.to(chars, {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: 'power3.out',
    stagger: 0.06,
  })
    .to(rule, { width: 60, duration: 0.3, ease: 'power2.inOut' }, '+=0.4')
    .to(sub, { opacity: 1, duration: 0.3, ease: 'power2.out' })
    .to({}, { duration: 0.6 }); // hold the complete lockup

  const animation = tl.then();

  return Promise.all([animation, readySettled])
    .then(() => {
      // If Three.js was the slow one, the pulse dot is running, so stop it first.
      if (dot) gsap.killTweensOf(dot);
      return gsap.to(loader, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }).then();
    })
    .then(finish)
    .catch(() => finish());
}

/** Shows the pulsing "still loading" dot. Called by main.js if boot runs long. */
export function showLoaderPulse() {
  const dot = document.querySelector('.loader__dot');
  if (!dot || prefersReducedMotion()) return;
  gsap.to(dot, {
    opacity: 0.9,
    duration: 0.5,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
}
