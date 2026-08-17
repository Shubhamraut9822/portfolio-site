import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scroll wired into the single gsap.ticker loop, plus every
 * scroll driven animation on the site.
 */
export function initScroll({ scene = null, reducedMotion = false, isMobile = false } = {}) {
  let lenis = null;

  if (!reducedMotion) {
    lenis = new Lenis({ lerp: 0.075 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // ------------------------------------------------------- content entrances
  const reveals = [...document.querySelectorAll('.reveal')];

  if (reducedMotion) {
    gsap.set(reveals, { opacity: 1, y: 0, x: 0 });
  } else {
    // Group siblings so a row of cards staggers together rather than one by one.
    const groups = new Map();
    reveals.forEach((el) => {
      const key = el.closest('[data-reveal-group]') || el.parentElement;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    });

    groups.forEach((items) => {
      const fromX = items[0].dataset.revealX;
      gsap.fromTo(
        items,
        { opacity: 0, y: fromX ? 0 : 24, x: fromX ? Number(fromX) : 0 },
        {
          opacity: 1,
          y: 0,
          x: 0,
          duration: 0.75,
          ease: 'power3.out',
          stagger: fromX ? 0.12 : 0.08,
          scrollTrigger: {
            trigger: items[0].closest('section, footer') || items[0],
            start: 'top 78%',
            toggleActions: 'play none none none',
          },
        }
      );
    });
  }

  // -------------------------------------------------------------- parallax
  if (!reducedMotion && !isMobile) {
    const parallax = (el, speed) => {
      const host = el.closest('section, footer, .hero') || document.body;
      const d = (1 - speed) * window.innerHeight * 0.5;
      gsap.fromTo(
        el,
        { y: -d },
        {
          y: d,
          ease: 'none',
          scrollTrigger: {
            trigger: host,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );
    };

    document.querySelectorAll('.ghost').forEach((el) => parallax(el, 0.25));
    document.querySelectorAll('[data-glyph]').forEach((el, i) => parallax(el, 1.15 + (i % 4) * 0.08));
    document.querySelectorAll('.blob').forEach((el, i) => parallax(el, i % 2 ? 0.5 : 0.72));
    document.querySelectorAll('[data-thread]').forEach((el) => parallax(el, 1.1));
  }

  // ---------------------------------------------------------- scroll cue
  const cue = document.querySelector('.scroll-cue');
  if (cue && !reducedMotion) {
    ScrollTrigger.create({
      start: () => `${window.innerHeight * 0.12} top`,
      onEnter: () => gsap.to(cue, { opacity: 0, duration: 0.4 }),
      onLeaveBack: () => gsap.to(cue, { opacity: 1, duration: 0.4 }),
    });
  }

  // ------------------------------------------------------- timeline (playbooks)
  const timeline = document.querySelector('[data-timeline]');
  if (timeline && !reducedMotion) {
    const track = timeline.querySelector('.timeline__track');
    const phases = [...timeline.querySelectorAll('.phase')];
    const vertical = window.innerWidth <= 768;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: timeline, start: 'top 76%', toggleActions: 'play none none none' },
    });

    if (track) {
      tl.fromTo(
        track,
        { scaleX: vertical ? 1 : 0, scaleY: vertical ? 0 : 1 },
        { scaleX: 1, scaleY: 1, duration: 1.1, ease: 'power2.out' },
        0
      );
    }

    phases.forEach((p, i) => {
      tl.fromTo(
        p.querySelector('.phase__dot'),
        { scale: 0 },
        { scale: 1, duration: 0.35, ease: 'back.out(2)' },
        0.15 + i * 0.1
      );
      tl.fromTo(
        p.querySelector('.phase__body'),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
        0.2 + i * 0.1
      );
    });
  }

  // ------------------------------------------------------------- 3D scene
  let heroTimeline = null;

  // Under reduced motion the scene is frozen in its assembled state, so it
  // gets no scroll triggers at all.
  if (scene && !reducedMotion) {
    // One scrub for orbit, fog density and ember thinning across the page.
    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      onUpdate: (self) => scene.setScrollProgress(self.progress),
    });

    // Rings 2 to 5 lock in section by section. Ring 1 belongs to the hero
    // flash, ring 6 belongs to the finale.
    document.querySelectorAll('[data-ring]').forEach((section) => {
      const index = Number(section.dataset.ring);
      ScrollTrigger.create({
        trigger: section,
        start: 'top 68%',
        once: true,
        onEnter: () => scene.revealRing(index),
      });
    });

    const closing = document.querySelector('[data-finale]');
    if (closing) {
      ScrollTrigger.create({
        trigger: closing,
        start: 'top 72%',
        once: true,
        onEnter: () => scene.runFinale(),
      });
    }
  }

  // --------------------------------------------------------- hero headline
  const hero = document.querySelector('.hero');
  if (hero) {
    const eyebrow = hero.querySelector('.eyebrow');
    const lines = [...hero.querySelectorAll('.line__inner')];
    const sub = hero.querySelector('.hero__sub');
    const btns = [...hero.querySelectorAll('.btn-row .btn')];
    const emblem = hero.querySelector('.emblem');
    const parts = [eyebrow, sub, ...btns, emblem, cue].filter(Boolean);

    if (reducedMotion) {
      gsap.set([...lines, ...parts], { opacity: 1, y: 0, clipPath: 'none' });
    } else {
      gsap.set(parts, { opacity: 0, y: 16 });
      gsap.set(lines, { yPercent: 105, clipPath: 'inset(100% 0% 0% 0%)' });

      heroTimeline = gsap.timeline({ paused: true });

      heroTimeline.to(eyebrow, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0);

      // Percussive: the headline lands on the same beat as the flash.
      heroTimeline.to(
        lines,
        {
          yPercent: 0,
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.5,
          ease: 'power3.out',
          stagger: 0.08,
        },
        0.12
      );

      heroTimeline.to(sub, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.37);
      heroTimeline.to(
        btns,
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08 },
        0.82
      );
      if (emblem) heroTimeline.to(emblem, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.5);
      if (cue) heroTimeline.to(cue, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 1.0);
    }
  }

  requestAnimationFrame(() => ScrollTrigger.refresh());

  return {
    lenis,
    heroTimeline,
    refresh: () => ScrollTrigger.refresh(),
  };
}
