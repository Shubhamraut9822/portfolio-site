/**
 * Scroll system: Lenis smooth scrolling, the multi-speed parallax stage, the
 * scroll-driven assembly of the 3D structure, and every entrance animation.
 *
 * Lenis drives GSAP's ticker, so ScrollTrigger and the smooth scroll never
 * disagree about where the page is.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { isMobile, prefersReducedMotion, onResize } from './env.js';

gsap.registerPlugin(ScrollTrigger);

let lenis = null;

/* -------------------------------------------------------------------------- */
/* Lenis                                                                      */
/* -------------------------------------------------------------------------- */

export function initSmoothScroll() {
  if (prefersReducedMotion()) {
    // Native scrolling only; ScrollTrigger still works off the window.
    ScrollTrigger.refresh();
    return null;
  }

  lenis = new Lenis({
    lerp: 0.07,
    wheelMultiplier: 1,
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    // GSAP's ticker reports seconds; Lenis wants milliseconds.
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

export const getLenis = () => lenis;

/** Current scroll offset, whichever scroller is in charge. */
const scrollY = () => (lenis ? lenis.scroll : window.scrollY || window.pageYOffset);

/* -------------------------------------------------------------------------- */
/* Depth layers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The parallax stage.
 *
 * The stage spans the whole document, so its children sit at real page
 * coordinates and scroll normally by default. Depth comes from a per-element
 * offset scrubbed across that element's own trip through the viewport: it
 * starts `distance` above its resting place and ends `distance` below it.
 *
 * Doing it per element rather than as one global speed multiplier is what keeps
 * a 0.3x layer correctly framed at the bottom of a long page. A global factor
 * would drift it further off-screen the deeper it sits.
 */
export function initDepthLayers() {
  const tracks = [...document.querySelectorAll('.depth-track')];
  if (!tracks.length) return;

  /** Pins a decorative element to the section it belongs to. */
  const placeAnchored = () => {
    document.querySelectorAll('[data-anchor]').forEach((el) => {
      const target = document.querySelector(el.dataset.anchor);
      if (!target) return;
      const offset = parseFloat(el.dataset.offset || '0');
      const rect = target.getBoundingClientRect();
      el.style.top = `${rect.top + scrollY() + rect.height * offset}px`;
    });
  };

  placeAnchored();

  // Anchors depend on final layout, so re-run once fonts and images have settled.
  window.addEventListener('load', placeAnchored, { once: true });
  onResize(() => {
    placeAnchored();
    ScrollTrigger.refresh();
  });

  // Flat mode: elements simply scroll with the document.
  if (prefersReducedMotion() || isMobile()) return;

  tracks.forEach((track) => {
    const speed = parseFloat(track.dataset.speed || '1');
    if (speed === 1) return;

    [...track.children].forEach((el) => {
      // The slower the layer, the further it travels against the scroll.
      const distance = window.innerHeight * (1 - speed) * 0.6;
      const centered = el.dataset.align === 'center' ? -50 : 0;

      gsap.fromTo(
        el,
        { y: -distance, xPercent: centered },
        {
          y: distance,
          xPercent: centered,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 3D assembly                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ties each assembly phase to the section that narrates it.
 *
 *   hero              → the core pillars rise
 *   what I do         → the risk platform slides in
 *   frameworks        → the control blocks drop
 *   reference build   → the control wiring draws itself
 *   wizard            → the crown descends
 *   closing CTA       → the finished structure settles into its coral pulse
 *
 * Driving this off one document-wide timeline was the obvious first move, but
 * it makes each phase's timing depend on how tall every *other* section happens
 * to be: edit some copy and the crown lands in the wrong place. Anchoring each
 * phase to its own section keeps the choreography locked to the story.
 *
 * @param {object} three The handle returned by initThreeScene().
 */
export function initSceneAssembly(three) {
  if (!three) return;

  const { parts, structure, setAssembled } = three;
  const { pillars, riskLayer, controls, connections, crown } = parts;

  // Reduced motion: show the finished structure, skip the choreography entirely.
  if (prefersReducedMotion()) {
    structure.position.y = 0;
    pillars.children.forEach((p) => (p.scale.y = 1));
    pillars.position.y = pillars.userData.baseY;
    riskLayer.position.set(0, riskLayer.userData.baseY, 0);
    riskLayer.scale.setScalar(1);
    controls.children.forEach((block) => {
      block.position.y = 0;
      block.scale.setScalar(1);
    });
    connections.geometry.setDrawRange(0, connections.userData.vertexCount);
    connections.material.opacity = 0.55;
    crown.position.y = crown.userData.baseY;
    crown.scale.setScalar(1);
    setAssembled(1);
    return;
  }

  /* --- Starting state: only the foundation exists ----------------------- */

  pillars.children.forEach((pillar) => {
    pillar.scale.y = 0.001;
    pillar.position.y = -0.9; // grows upward from the plate
  });
  // Far enough left to clear the frustum entirely. At -6 it was still visible
  // behind the hero headline before its cue.
  riskLayer.position.set(-16, riskLayer.userData.baseY, 0);
  riskLayer.scale.setScalar(0.9);
  controls.children.forEach((block) => {
    block.position.y = 4;
    block.scale.setScalar(0.001);
  });
  connections.geometry.setDrawRange(0, 0);
  crown.position.y = 6.5;
  crown.scale.setScalar(0.4);

  // The structure starts lifted so the lone foundation plate sits near the
  // centre of frame, then settles as the upper layers fill the space above it.
  structure.position.y = 1.5;

  /* --- One scrubbed timeline per narrative section ---------------------- */

  /**
   * Builds a timeline scrubbed across `selector`'s pass through the viewport.
   * Falls back to the document if a section is missing, so a trimmed page can
   * never break the scene.
   */
  const phase = (selector, start, end) =>
    gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: {
        trigger: document.querySelector(selector) || document.body,
        start,
        end,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

  // Across the whole page: the structure settles downward as it grows upward,
  // keeping the composition centred at every stage.
  gsap.to(structure.position, {
    y: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
    },
  });

  // Hero: the four core pillars rise out of the foundation, staggered.
  phase('#hero', 'top top', 'bottom top')
    .to(
      pillars.children.map((p) => p.scale),
      { y: 1, duration: 1, stagger: 0.12, ease: 'power2.out' },
      0
    )
    .to(
      pillars.children.map((p) => p.position),
      { y: 0, duration: 1, stagger: 0.12, ease: 'power2.out' },
      0
    );

  // What I do: the risk platform slides in from the left and locks into place.
  phase('#services', 'top 85%', 'bottom 45%')
    .to(riskLayer.position, { x: 0, duration: 1, ease: 'power3.out' }, 0)
    .to(riskLayer.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'power2.out' }, 0.2);

  // Frameworks: control blocks drop in one at a time and land with a bounce.
  const blocks = phase('#frameworks', 'top 85%', 'bottom 40%');
  controls.children.forEach((block, index) => {
    const at = index * 0.09;
    blocks
      .to(block.position, { y: 0, duration: 0.5, ease: 'back.out(2.2)' }, at)
      .to(block.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'power2.out' }, at);
  });

  // Reference Build: the wiring draws itself between the controls.
  const draw = { count: 0 };
  phase('#reference-teaser', 'top 90%', 'bottom 40%').to(draw, {
    count: connections.userData.vertexCount,
    duration: 1,
    ease: 'none',
    onUpdate: () => connections.geometry.setDrawRange(0, Math.floor(draw.count)),
  });

  // Wizard: the crown descends into position.
  phase('#wizard-teaser', 'top 90%', 'bottom 55%')
    .to(crown.position, { y: crown.userData.baseY, duration: 1, ease: 'power3.out' }, 0)
    .to(crown.scale, { x: 1, y: 1, z: 1, duration: 1, ease: 'back.out(1.6)' }, 0);

  // Closing CTA: hand off to the render loop's settled coral pulse. This runs
  // while the CTA is still rising into frame, so the finished structure is
  // visible above it rather than hidden behind the opaque panel.
  const settle = { v: 0 };
  phase('#contact', 'top bottom', 'top 25%').to(settle, {
    v: 1,
    duration: 1,
    ease: 'none',
    onUpdate: () => setAssembled(settle.v),
  });
}

/* -------------------------------------------------------------------------- */
/* Entrance animations                                                        */
/* -------------------------------------------------------------------------- */

const REVEAL_PRESETS = {
  up: { y: 40, x: 0 },
  left: { y: 0, x: -40 },
  right: { y: 0, x: 40 },
  fade: { y: 0, x: 0 },
};

/**
 * Generic scroll-triggered reveals. Any element with `data-reveal` fades and
 * slides in once; `data-reveal-group` staggers a container's direct children.
 */
export function initReveals() {
  const reduced = prefersReducedMotion();

  if (reduced) {
    document.documentElement.classList.add('no-motion');
    return;
  }

  document.querySelectorAll('[data-reveal-group]').forEach((group) => {
    const items = [...group.children];
    const preset = REVEAL_PRESETS[group.dataset.revealGroup] || REVEAL_PRESETS.up;
    gsap.set(items, { opacity: 0, ...preset });
    gsap.to(items, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: {
        trigger: group,
        start: 'top 82%',
        toggleActions: 'play none none none',
      },
    });
  });

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    // Group children are handled above.
    if (el.parentElement?.hasAttribute('data-reveal-group')) return;

    const preset = REVEAL_PRESETS[el.dataset.reveal] || REVEAL_PRESETS.up;
    const delay = parseFloat(el.dataset.revealDelay || '0');

    gsap.set(el, { opacity: 0, ...preset });
    gsap.to(el, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.9,
      delay,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    });
  });
}

/** Counts the Reference Build stat blocks up from zero when they scroll in. */
export function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const reduced = prefersReducedMotion();

  counters.forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.countSuffix || '';

    if (reduced) {
      el.textContent = `${target}${suffix}`;
      return;
    }

    const value = { n: 0 };
    el.textContent = `0${suffix}`;

    gsap.to(value, {
      n: target,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = `${Math.round(value.n)}${suffix}`;
      },
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    });
  });
}

/**
 * Hero entrance. Called once the loading screen has cleared so the choreography
 * is the first thing the visitor sees rather than something they missed.
 */
export function playHeroEntrance(three) {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const eyebrow = hero.querySelector('.eyebrow');
  const lines = hero.querySelectorAll('.hero__title .line > span');
  const subline = hero.querySelector('.lede');
  const buttons = hero.querySelector('.btn-row');
  const cue = document.querySelector('.scroll-cue');

  if (prefersReducedMotion()) {
    gsap.set([eyebrow, ...lines, subline, buttons, cue], { opacity: 1, y: 0 });
    three?.reveal();
    return;
  }

  gsap.set([eyebrow, subline, buttons, cue], { opacity: 0, y: 20 });
  gsap.set(lines, { opacity: 0, yPercent: 110 });

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.7 }, 0.4)
    .to(lines, { opacity: 1, yPercent: 0, duration: 1, stagger: 0.15 }, 0.5)
    .to(subline, { opacity: 1, y: 0, duration: 0.8 }, 0.9)
    .to(buttons, { opacity: 1, y: 0, duration: 0.8 }, 1.1)
    .to(cue, { opacity: 1, y: 0, duration: 0.6 }, 1.4);

  // The foundation plate fades up alongside the copy.
  if (three) {
    three.reveal();
    gsap.fromTo(
      three.structure.scale,
      { x: 0.64, y: 0.64, z: 0.64 },
      {
        x: three.structure.scale.x,
        y: three.structure.scale.y,
        z: three.structure.scale.z,
        duration: 1.6,
        ease: 'power3.out',
        delay: 0.5,
      }
    );
  }
}

/** Fades the scroll cue out once the visitor has moved past 10vh. */
export function initScrollCue() {
  const cue = document.querySelector('.scroll-cue');
  if (!cue) return;

  ScrollTrigger.create({
    start: () => `${window.innerHeight * 0.1} top`,
    onEnter: () => gsap.to(cue, { opacity: 0, duration: 0.4, overwrite: 'auto' }),
    onLeaveBack: () => gsap.to(cue, { opacity: 1, duration: 0.4, overwrite: 'auto' }),
  });
}

/**
 * The frameworks ticker.
 *
 * The tile set is duplicated in markup; translating the track by exactly -50%
 * lands on an identical frame, so the loop is seamless at any speed.
 */
export function initTicker() {
  const track = document.querySelector('.ticker__track');
  if (!track) return;

  if (prefersReducedMotion()) return;

  gsap.to(track, {
    xPercent: -50,
    duration: 42,
    ease: 'none',
    repeat: -1,
  });
}
