import gsap from 'gsap';

/**
 * Loading screen. Still gates the reveal on real asset and scene readiness,
 * there is simply no numeric readout of it any more. The name resolves out of
 * blur, a coral rule and the tagline follow, and LOADING breathes underneath
 * until the scene is ready.
 */
export function createLoader({ reducedMotion = false, isMobile = false } = {}) {
  const el = document.querySelector('[data-loader]');
  if (!el) {
    return { set() {}, finish: () => Promise.resolve() };
  }

  const nameEl = el.querySelector('[data-loader-name]');
  const rule = el.querySelector('[data-loader-rule]');
  const tagline = el.querySelector('[data-loader-tagline]');
  const status = el.querySelector('[data-loader-status]');

  // The animation is simpler than it was, so it needs longer to still read as
  // deliberate rather than as a flash of text.
  const MIN_DURATION = isMobile ? 2.8 : 3.6;
  const started = performance.now();

  // Split the name into per character spans for the blur resolve.
  const label = nameEl.textContent.trim();
  nameEl.textContent = '';
  const chars = [...label].map((ch) => {
    const span = document.createElement('span');
    span.className = 'loader__char';
    span.textContent = ch === ' ' ? ' ' : ch;
    nameEl.appendChild(span);
    return span;
  });
  nameEl.setAttribute('aria-label', label);

  if (reducedMotion) {
    el.remove();
    return { set() {}, finish: () => Promise.resolve() };
  }

  // --- entrance ------------------------------------------------------------
  gsap.set(chars, { scale: 1.06 });

  const tl = gsap.timeline();

  tl.to(
    chars,
    {
      opacity: 1,
      filter: 'blur(0px)',
      scale: 1,
      duration: 0.5,
      ease: 'power2.out',
      stagger: 0.055,
    },
    0.3
  );

  tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, 0.9);
  tl.to(tagline, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 1.05);
  tl.to(status, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 1.3);

  // Without a counter, this is what tells the visitor something is happening.
  const breathe = gsap.to(status, {
    opacity: 0.6,
    duration: 0.7,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
    delay: 1.7,
  });

  /**
   * Real progress still gates dismissal, it just is not drawn any more. Kept
   * as a no-op shaped API so the call sites in main.js read the same as before.
   */
  function set() {}

  /**
   * Runs the exit. Resolves as the disperse starts, so the hero entrance can
   * overlap with the loader clearing.
   */
  function finish() {
    return new Promise((resolve) => {
      const elapsed = (performance.now() - started) / 1000;
      const wait = Math.max(0, MIN_DURATION - elapsed);

      gsap.delayedCall(wait, () => {
        breathe.kill();

        const out = gsap.timeline({ onComplete: () => el.remove() });

        // Disperse like clearing smoke, staggered outward from the centre.
        out.to(
          chars,
          {
            opacity: 0,
            filter: 'blur(14px)',
            scale: 1.08,
            duration: 0.7,
            ease: 'power2.inOut',
            stagger: { each: 0.03, from: 'center' },
          },
          0
        );
        out.to(
          [rule, tagline, status],
          {
            opacity: 0,
            filter: 'blur(14px)',
            scale: 1.08,
            duration: 0.7,
            ease: 'power2.inOut',
          },
          0
        );
        out.to(el, { opacity: 0, duration: 0.4, ease: 'power2.inOut' }, 0.45);

        // Hand off early so the hero begins while the loader is still clearing.
        gsap.delayedCall(0.1, resolve);
      });
    });
  }

  return { set, finish };
}
