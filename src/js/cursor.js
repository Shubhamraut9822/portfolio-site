/**
 * Custom cursor.
 *
 * A 12px coral ring that trails the pointer with a little easing and swells to
 * 40px over anything clickable. Desktop / fine-pointer only — touch devices
 * keep their native behaviour and never see this.
 *
 * Also broadcasts the normalised pointer position, which the 3D scene uses for
 * its camera and structure tilt.
 */
import { gsap } from 'gsap';
import { hasFinePointer, isMobile, prefersReducedMotion } from './env.js';

const HOVER_SELECTOR =
  'a, button, [role="button"], input, .ticker__item, .service-card, .tile, ' +
  '.template-card, .playbook-card, .cred-tile, .accordion__head, .filter-btn';

/**
 * @param {(x: number, y: number) => void} [onMove] Receives pointer coordinates
 *   normalised to -1…1, called on every move regardless of cursor visibility.
 */
export function initCursor(onMove) {
  // The pointer feed is useful even when the visual cursor is disabled.
  const broadcast = (event) => {
    onMove?.(
      (event.clientX / window.innerWidth) * 2 - 1,
      -((event.clientY / window.innerHeight) * 2 - 1)
    );
  };

  if (!hasFinePointer() || isMobile()) {
    window.addEventListener('pointermove', broadcast, { passive: true });
    return;
  }

  const cursor = document.querySelector('.cursor');
  if (!cursor) {
    window.addEventListener('pointermove', broadcast, { passive: true });
    return;
  }

  document.documentElement.classList.add('has-custom-cursor');

  const reduced = prefersReducedMotion();
  // quickTo gives a cheap, always-interruptible eased follow.
  const moveX = gsap.quickTo(cursor, 'x', {
    duration: reduced ? 0 : 0.35,
    ease: 'power3.out',
  });
  const moveY = gsap.quickTo(cursor, 'y', {
    duration: reduced ? 0 : 0.35,
    ease: 'power3.out',
  });

  let visible = false;

  window.addEventListener(
    'pointermove',
    (event) => {
      broadcast(event);
      moveX(event.clientX);
      moveY(event.clientY);

      if (!visible) {
        visible = true;
        cursor.classList.add('is-active');
      }
    },
    { passive: true }
  );

  // Hover state is delegated, so nodes added later (filtered cards, opened
  // accordions) are picked up without re-binding anything.
  document.addEventListener(
    'pointerover',
    (event) => {
      if (event.target instanceof Element && event.target.closest(HOVER_SELECTOR)) {
        cursor.classList.add('is-hover');
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'pointerout',
    (event) => {
      if (event.target instanceof Element && event.target.closest(HOVER_SELECTOR)) {
        cursor.classList.remove('is-hover');
      }
    },
    { passive: true }
  );

  document.addEventListener('pointerdown', () => cursor.classList.add('is-hover'));
  document.addEventListener('pointerup', () => cursor.classList.remove('is-hover'));

  // Hide when the pointer leaves the window entirely.
  document.addEventListener('mouseleave', () => {
    visible = false;
    cursor.classList.remove('is-active');
  });
  document.addEventListener('mouseenter', () => {
    visible = true;
    cursor.classList.add('is-active');
  });
}
