/**
 * Shared interface behaviour used across every page: the header, the mobile
 * overlay menu, page-to-page fade transitions, and the two page-specific
 * widgets (the Reference Build accordion and the Templates filter).
 */
import { gsap } from 'gsap';
import { prefersReducedMotion } from './env.js';
import { getLenis } from './scroll-animations.js';

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

/** Swaps the header to its blurred state once the page has scrolled 50px. */
export function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const update = () => {
    const y = getLenis()?.scroll ?? window.scrollY;
    header.classList.toggle('is-scrolled', y > 50);
  };

  update();
  gsap.ticker.add(update);
}

/* -------------------------------------------------------------------------- */
/* Mobile menu                                                                */
/* -------------------------------------------------------------------------- */

export function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.mobile-menu');
  const close = document.querySelector('.mobile-menu__close');
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    // Lenis keeps scrolling the page underneath unless it is explicitly stopped.
    if (open) getLenis()?.stop();
    else getLenis()?.start();
  };

  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  close?.addEventListener('click', () => setOpen(false));
  menu.querySelectorAll('a').forEach((link) =>
    link.addEventListener('click', () => setOpen(false))
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
  });
}

/* -------------------------------------------------------------------------- */
/* Page transitions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Fades the current page out before navigating to another page of the site.
 * External links, new-tab clicks, mailto and in-page anchors are left alone.
 */
export function initPageTransitions() {
  const veil = document.querySelector('.page-veil');
  if (!veil) return;

  const reduced = prefersReducedMotion();

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }
    if (link.target === '_blank' || link.hasAttribute('download')) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname) return;

    event.preventDefault();
    document.body.classList.add('is-leaving');

    if (reduced) {
      window.location.href = url.href;
      return;
    }

    gsap.to(veil, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.inOut',
      onComplete: () => {
        window.location.href = url.href;
      },
    });
  });

  // Restoring from the back/forward cache would otherwise leave the veil up.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      document.body.classList.remove('is-leaving');
      gsap.set(veil, { opacity: 0 });
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Accordion (Reference Build document groups)                                */
/* -------------------------------------------------------------------------- */

export function initAccordion() {
  const groups = document.querySelectorAll('.accordion__group');
  if (!groups.length) return;

  const reduced = prefersReducedMotion();

  groups.forEach((group) => {
    const head = group.querySelector('.accordion__head');
    const body = group.querySelector('.accordion__body');
    if (!head || !body) return;

    const startOpen = head.getAttribute('aria-expanded') === 'true';
    gsap.set(body, { height: startOpen ? 'auto' : 0 });

    head.addEventListener('click', () => {
      const isOpen = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!isOpen));

      if (reduced) {
        gsap.set(body, { height: isOpen ? 0 : 'auto' });
        return;
      }

      gsap.to(body, {
        height: isOpen ? 0 : 'auto',
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => getLenis()?.resize(),
      });
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Templates filter                                                           */
/* -------------------------------------------------------------------------- */

export function initFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.template-card');
  if (!buttons.length || !cards.length) return;

  const reduced = prefersReducedMotion();

  const apply = (filter) => {
    cards.forEach((card) => {
      const matches = filter === 'all' || card.dataset.framework === filter;
      const wasHidden = card.classList.contains('is-hidden');

      if (matches && wasHidden) {
        card.classList.remove('is-hidden');
        if (!reduced) {
          gsap.fromTo(
            card,
            { opacity: 0, scale: 0.94 },
            { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }
          );
        }
      } else if (!matches && !wasHidden) {
        if (reduced) {
          card.classList.add('is-hidden');
        } else {
          gsap.to(card, {
            opacity: 0,
            scale: 0.94,
            duration: 0.2,
            ease: 'power2.in',
            onComplete: () => card.classList.add('is-hidden'),
          });
        }
      }
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.toggle('is-active', b === button));
      apply(button.dataset.filter);
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Non-functional forms                                                       */
/* -------------------------------------------------------------------------- */

/** The template-bundle form is a visual placeholder; stop it from navigating. */
export function initInertForms() {
  document.querySelectorAll('form[data-inert]').forEach((form) => {
    form.addEventListener('submit', (event) => event.preventDefault());
  });
}
