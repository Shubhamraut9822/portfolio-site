import gsap from 'gsap';

/**
 * Foreground line-art layer. Hand coded SVG only, never raster.
 *
 * Two elements, deliberately:
 *   the seal    a geometric rosette, on closing and contact blocks only
 *   the threads long curved strokes carrying a slow travelling highlight,
 *               running through every page as ambient connective texture
 *
 * Nested transforms, one job each:
 *   .glyph        scroll parallax   (owned by scroll.js)
 *   .glyph__inner cursor tilt       (owned here)
 *   svg           idle drift        (owned here)
 */

// A six petal rosette: one bounding circle and six arcs whose centres sit on
// a smaller circle. No fill, no ribbon, not a badge.
const SEAL = `
  <svg viewBox="0 0 160 160" aria-hidden="true" focusable="false">
    <circle cx="80" cy="80" r="68"/>
    <circle cx="80" cy="80" r="33"/>
    <circle cx="113" cy="80" r="33"/>
    <circle cx="96.5" cy="108.6" r="33"/>
    <circle cx="63.5" cy="108.6" r="33"/>
    <circle cx="47" cy="80" r="33"/>
    <circle cx="63.5" cy="51.4" r="33"/>
    <circle cx="96.5" cy="51.4" r="33"/>
  </svg>`;

const THREAD = `
  <svg viewBox="0 0 1200 420" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d="M-40 60C240 190 420 -20 700 130s330 250 560 140"/>
    <path class="thread__spark" d="M-40 60C240 190 420 -20 700 130s330 250 560 140"
          stroke-dasharray="150 4000" stroke-dashoffset="4000"/>
  </svg>`;

export function initGlyphs({ reducedMotion, isMobile }) {
  const seals = [...document.querySelectorAll('[data-glyph="seal"]')];
  const threads = [...document.querySelectorAll('[data-thread]')];

  seals.forEach((node) => {
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = `<span class="glyph__inner">${SEAL}</span>`;
  });

  threads.forEach((node) => {
    node.innerHTML = THREAD;
    node.setAttribute('aria-hidden', 'true');
  });

  if (reducedMotion) return;

  // A slow travelling highlight along each thread, echoing the ring orbits.
  threads.forEach((node, i) => {
    const spark = node.querySelector('.thread__spark');
    if (!spark) return;
    gsap.fromTo(
      spark,
      { strokeDashoffset: 4000 },
      { strokeDashoffset: 0, duration: 6, ease: 'none', repeat: -1, delay: i * 2.1 }
    );
  });

  const glyphs = seals
    .map((node) => {
      const inner = node.querySelector('.glyph__inner');
      const svg = node.querySelector('svg');
      return inner && svg ? { node, inner, svg } : null;
    })
    .filter(Boolean);

  // Idle drift, deliberately out of sync with every neighbour.
  glyphs.forEach((g, i) => {
    if (!isMobile) {
      gsap.to(g.svg, {
        x: gsap.utils.random(-8, 8),
        y: gsap.utils.random(-10, 10),
        rotation: gsap.utils.random(-1.5, 1.5),
        duration: gsap.utils.random(9, 14),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        delay: i * 0.7,
      });
    }
    g.base = parseFloat(getComputedStyle(g.node).opacity) || 0.1;
    g.rx = 0;
    g.ry = 0;
    g.op = g.base;
    gsap.set(g.inner, { transformPerspective: 700 });
  });

  if (isMobile || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (!glyphs.length) return;

  // "It noticed you": brighten and lean toward a nearby pointer.
  const pointer = { x: -9999, y: -9999 };
  const RANGE = 220;
  const TILT = 6;

  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    },
    { passive: true }
  );

  gsap.ticker.add(() => {
    const vh = window.innerHeight;

    glyphs.forEach((g) => {
      const r = g.node.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;

      const dx = pointer.x - (r.left + r.width / 2);
      const dy = pointer.y - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);

      let tRx = 0;
      let tRy = 0;
      let tOp = g.base;

      if (dist < RANGE) {
        const t = 1 - dist / RANGE;
        tRy = gsap.utils.clamp(-TILT, TILT, (dx / RANGE) * TILT * 2 * t);
        tRx = gsap.utils.clamp(-TILT, TILT, (-dy / RANGE) * TILT * 2 * t);
        tOp = g.base * (1 + 0.6 * t);
      }

      g.rx += (tRx - g.rx) * 0.08;
      g.ry += (tRy - g.ry) * 0.08;
      g.op += (tOp - g.op) * 0.08;

      g.inner.style.transform = `perspective(700px) rotateX(${g.rx.toFixed(3)}deg) rotateY(${g.ry.toFixed(3)}deg)`;
      g.node.style.opacity = g.op.toFixed(4);
    });
  });
}
