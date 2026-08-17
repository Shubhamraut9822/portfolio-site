import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * The site is served with clean URLs, so /about, /about.html and /about/ are
 * all the same page. Everything that compares locations goes through here.
 */
function normalisePath(pathname) {
  const p = pathname
    .replace(/\/index(\.html)?$/i, '/')
    .replace(/\.html$/i, '')
    .replace(/(.)\/$/, '$1');
  return p === '' ? '/' : p;
}

export function initUI({ reducedMotion = false } = {}) {
  markCurrentPage();
  initHeader();
  initMobileMenu();
  initMarquee();
  initAccordions({ reducedMotion });
  initFilters({ reducedMotion });
  initCounters({ reducedMotion });
  initPageTransitions({ reducedMotion });
  initBackForwardRestore();
  initMailtoFallback();
}

/* ------------------------------------------------- back / forward restore */

/**
 * The leave transition fades the body to zero. When the browser restores a
 * page from bfcache it restores that faded state too, and `load` never fires
 * again, so nothing would bring it back. `pageshow` is the one event that
 * does fire on a cached restore.
 */
function initBackForwardRestore() {
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;

    document.body.classList.remove('is-leaving');
    document.body.classList.add('is-ready');
    document.body.style.transition = 'none';
    document.body.style.opacity = '1';

    // Hand styling back to the stylesheet once the frame has painted, so the
    // next outgoing transition still animates.
    requestAnimationFrame(() => {
      document.body.style.transition = '';
      document.body.style.opacity = '';
    });
  });
}

/* -------------------------------------------------------- mailto fallback */

/**
 * A mailto link does nothing visible on a machine with no mail client
 * registered, which reads as a dead button. Copy the address as well, so the
 * click always produces a result.
 */
function initMailtoFallback() {
  document.addEventListener('click', (e) => {
    const link = e.target instanceof Element ? e.target.closest('a[href^="mailto:"]') : null;
    if (!link) return;

    const address = link.getAttribute('href').replace(/^mailto:/, '').split('?')[0];
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;

    navigator.clipboard.writeText(address).then(
      () => toast(`Email address copied: ${address}`),
      () => {}
    );
  });
}

let toastTimer = 0;

function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }

  el.textContent = message;
  requestAnimationFrame(() => el.classList.add('is-in'));

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-in'), 2800);
}

/* -------------------------------------------------------------- nav state */

function markCurrentPage() {
  const here = normalisePath(window.location.pathname);
  document.querySelectorAll('[data-nav] a').forEach((a) => {
    if (normalisePath(new URL(a.href).pathname) !== here) return;
    a.classList.add('is-current');
    a.setAttribute('aria-current', 'page');
  });
}

/* ----------------------------------------------------------------- header */

function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 60);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* ------------------------------------------------------------ mobile menu */

function initMobileMenu() {
  const burger = document.querySelector('[data-burger]');
  const menu = document.querySelector('[data-menu]');
  if (!burger || !menu) return;

  const close = menu.querySelector('[data-menu-close]');
  const links = [...menu.querySelectorAll('.menu__link')];

  links.forEach((l, i) => {
    l.style.animationDelay = `${0.08 + i * 0.06}s`;
  });

  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };

  burger.addEventListener('click', () => setOpen(true));
  if (close) close.addEventListener('click', () => setOpen(false));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

/* ---------------------------------------------------------------- marquee */

function initMarquee() {
  document.querySelectorAll('[data-marquee]').forEach((track) => {
    // The CSS loop translates by -50%, so the tile set must appear exactly twice.
    const clone = track.cloneNode(true);
    [...clone.children].forEach((child) => {
      child.setAttribute('aria-hidden', 'true');
      child.setAttribute('tabindex', '-1');
      track.appendChild(child);
    });
  });
}

/* ------------------------------------------------------------- accordions */

function initAccordions({ reducedMotion }) {
  document.querySelectorAll('[data-acc]').forEach((acc, index) => {
    const head = acc.querySelector('.acc__head');
    const panel = acc.querySelector('.acc__panel');
    const inner = acc.querySelector('.acc__inner');
    if (!head || !panel || !inner) return;

    const open = index === 0;
    acc.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', String(open));
    panel.style.height = open ? 'auto' : '0px';

    head.addEventListener('click', () => {
      const isOpen = acc.classList.contains('is-open');
      acc.classList.toggle('is-open', !isOpen);
      head.setAttribute('aria-expanded', String(!isOpen));

      if (reducedMotion) {
        panel.style.height = isOpen ? '0px' : 'auto';
        return;
      }

      gsap.killTweensOf(panel);
      if (isOpen) {
        gsap.fromTo(
          panel,
          { height: inner.offsetHeight },
          { height: 0, duration: 0.35, ease: 'power2.out', onComplete: () => ScrollTrigger.refresh() }
        );
      } else {
        gsap.fromTo(
          panel,
          { height: 0 },
          {
            height: inner.offsetHeight,
            duration: 0.35,
            ease: 'power2.out',
            onComplete: () => {
              panel.style.height = 'auto';
              ScrollTrigger.refresh();
            },
          }
        );
      }
    });
  });
}

/* ------------------------------------------------------------ template filters */

function initFilters({ reducedMotion }) {
  const bar = document.querySelector('[data-filters]');
  const grid = document.querySelector('[data-tpl-grid]');
  if (!bar || !grid) return;

  const cards = [...grid.querySelectorAll('[data-framework]')];

  bar.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.filter') : null;
    if (!btn) return;

    bar.querySelectorAll('.filter').forEach((f) => {
      const active = f === btn;
      f.classList.toggle('is-active', active);
      f.setAttribute('aria-pressed', String(active));
    });

    const want = btn.dataset.filter;

    cards.forEach((card) => {
      const match = want === 'all' || card.dataset.framework === want;

      if (reducedMotion) {
        card.classList.toggle('is-hidden', !match);
        return;
      }

      if (match) {
        card.classList.remove('is-hidden');
        gsap.fromTo(
          card,
          { opacity: 0, scale: 0.96 },
          { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out', overwrite: true }
        );
      } else {
        gsap.to(card, {
          opacity: 0,
          scale: 0.96,
          duration: 0.25,
          ease: 'power2.out',
          overwrite: true,
          onComplete: () => card.classList.add('is-hidden'),
        });
      }
    });

    gsap.delayedCall(0.3, () => ScrollTrigger.refresh());
  });
}

/* ------------------------------------------------------------- counters */

function initCounters({ reducedMotion }) {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.countSuffix || '';

    if (reducedMotion) {
      el.textContent = `${target}${suffix}`;
      return;
    }

    el.textContent = `0${suffix}`;
    const obj = { v: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          v: target,
          duration: 1.2,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = `${Math.round(obj.v)}${suffix}`;
          },
        });
      },
    });
  });
}

/* ------------------------------------------------------- page transitions */

function initPageTransitions({ reducedMotion }) {
  requestAnimationFrame(() => document.body.classList.add('is-ready'));

  if (reducedMotion) return;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const link = e.target instanceof Element ? e.target.closest('a') : null;
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return;
    }

    // Off site, mailto and tel all have a different origin. In page anchors and
    // the inert "#" links resolve to the page we are already on.
    if (url.origin !== window.location.origin) return;
    if (normalisePath(url.pathname) === normalisePath(window.location.pathname)) return;

    e.preventDefault();
    document.body.classList.add('is-leaving');
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 300);
  });
}
