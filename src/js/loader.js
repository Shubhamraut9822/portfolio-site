import gsap from 'gsap';

/**
 * Loading screen. Gates the reveal of the site until the scene is initialised.
 * Progress is real: main.js feeds it milestones. A slow auto-ramp keeps the
 * counter alive between milestones so it never stalls at a round number.
 */
export function createLoader({ reducedMotion = false, isMobile = false } = {}) {
  const el = document.querySelector('[data-loader]');
  if (!el) {
    return {
      set() {},
      finish: () => Promise.resolve(),
    };
  }

  const nameEl = el.querySelector('[data-loader-name]');
  const seed = el.querySelector('[data-loader-seed]');
  const ringPath = el.querySelector('[data-loader-ring]');
  const status = el.querySelector('[data-loader-status]');
  const pctEl = el.querySelector('[data-loader-pct]');

  const MIN_DURATION = isMobile ? 1.8 : 2.6;
  const started = performance.now();

  // Split the name into per-character spans for the blur-resolve.
  const label = nameEl.textContent.trim();
  nameEl.textContent = '';
  const chars = [...label].map((ch) => {
    const span = document.createElement('span');
    span.className = 'loader__char';
    span.textContent = ch === ' ' ? ' ' : ch;
    nameEl.appendChild(span);
    return span;
  });
  nameEl.setAttribute('aria-label', label);

  const circumference = ringPath ? 2 * Math.PI * Number(ringPath.getAttribute('r')) : 0;
  if (ringPath) {
    ringPath.style.strokeDasharray = `${circumference}`;
    ringPath.style.strokeDashoffset = `${circumference}`;
  }

  // --- reduced motion: no theatre, just get out of the way -----------------
  if (reducedMotion) {
    el.remove();
    return { set() {}, finish: () => Promise.resolve() };
  }

  const state = { pct: 0 };
  let target = 0;
  let ramp = null;

  const paint = () => {
    const v = Math.round(state.pct);
    if (pctEl) pctEl.textContent = `${String(v).padStart(3, '0')}%`;
    if (ringPath) {
      ringPath.style.strokeDashoffset = `${circumference * (1 - state.pct / 100)}`;
    }
  };

  paint();

  // --- entrance ------------------------------------------------------------
  const tl = gsap.timeline();

  tl.to(seed, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0);
  tl.to(
    seed,
    {
      scale: 1.25,
      opacity: 0.6,
      duration: 0.8,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    },
    0.2
  );

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

  tl.to(status, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.6);

  gsap.set(chars, { scale: 1.06 });

  /** Feed real progress in, 0 to 1. */
  function set(value) {
    target = Math.max(target, Math.min(1, value) * 100);
    if (ramp) ramp.kill();
    ramp = gsap.to(state, {
      pct: target,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: paint,
    });
  }

  // Creep forward slowly so the counter is never frozen between milestones.
  const creep = gsap.to(state, {
    duration: MIN_DURATION,
    ease: 'none',
    onUpdate() {
      const drift = Math.min(88, (creep.progress() * 100) ** 0.92);
      if (drift > state.pct) {
        state.pct = drift;
        paint();
      }
    },
  });

  /**
   * Runs the exit. Resolves when the disperse starts, so the hero entrance can
   * overlap with the loader clearing.
   */
  function finish() {
    return new Promise((resolve) => {
      const elapsed = (performance.now() - started) / 1000;
      const wait = Math.max(0, MIN_DURATION - elapsed);

      gsap.delayedCall(wait, () => {
        creep.kill();
        if (ramp) ramp.kill();

        // Never snap to 100, always ease into it.
        gsap.to(state, {
          pct: 100,
          duration: 0.4,
          ease: 'power2.out',
          onUpdate: paint,
          onComplete: () => {
            const out = gsap.timeline({
              delay: 0.45,
              onComplete: () => el.remove(),
            });

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
              [seed, el.querySelector('.loader__ring'), status],
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
          },
        });
      });
    });
  }

  return { set, finish };
}
