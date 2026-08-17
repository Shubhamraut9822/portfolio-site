import gsap from 'gsap';

const HOVER_SELECTOR = 'a, button, .acc__head, .filter, .fw-tile, input, [data-hover]';
const MAGNET_SELECTOR = '.btn, [data-magnetic]';

const MAX_PULL = 8; // px the element travels toward the pointer
const MAX_LABEL_PULL = 4; // px of parallax for the label inside it
const REACH = 90;

/**
 * Custom cursor, magnetic buttons, spotlight and click ripple.
 * Desktop pointers only. Everything here is decoration, so it degrades to
 * nothing at all rather than to a lesser version.
 */
export function initCursor({ reducedMotion, onMove } = {}) {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // The pointer is still tracked for the 3D scene even when the chrome is off.
  const track = (e) => {
    if (onMove) {
      onMove((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    }
  };

  if (!finePointer || reducedMotion) {
    if (finePointer) window.addEventListener('pointermove', track, { passive: true });
    return { destroy() {} };
  }

  document.documentElement.classList.add('has-custom-cursor');

  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const spot = document.createElement('div');
  spot.className = 'spotlight';
  document.body.append(spot, ring, dot);

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const ringP = { ...pos };
  const dotP = { ...pos };
  const spotP = { ...pos };
  let revealed = false;

  /* ------------------------------------------------------------ magnets --- */

  const magnets = [];

  // The label lags the button, giving a slight parallax inside the surface.
  const LABEL_RATIO = MAX_LABEL_PULL / MAX_PULL;

  function write(m) {
    m.el.style.transform = `translate3d(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px, 0)`;
    if (m.label) {
      const lx = (m.x * LABEL_RATIO).toFixed(2);
      const ly = (m.y * LABEL_RATIO).toFixed(2);
      m.label.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
    }
  }

  function registerMagnets() {
    document.querySelectorAll(MAGNET_SELECTOR).forEach((el) => {
      if (magnets.some((m) => m.el === el)) return;
      magnets.push({
        el,
        label: el.querySelector('.btn__label'),
        x: 0,
        y: 0,
        engaged: false,
        spring: null,
      });
    });
  }

  registerMagnets();

  function updateMagnets() {
    for (let i = magnets.length - 1; i >= 0; i -= 1) {
      const m = magnets[i];
      if (!m.el.isConnected) {
        magnets.splice(i, 1);
        continue;
      }

      const r = m.el.getBoundingClientRect();
      if (r.width === 0) continue;

      const cx = r.left + r.width / 2 - m.x;
      const cy = r.top + r.height / 2 - m.y;
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const reach = Math.max(r.width, r.height) / 2 + REACH;
      const dist = Math.hypot(dx, dy);

      if (dist < reach) {
        if (m.spring) {
          m.spring.kill();
          m.spring = null;
        }
        m.engaged = true;
        const pull = 1 - dist / reach;
        const tx = gsap.utils.clamp(-MAX_PULL, MAX_PULL, (dx / reach) * MAX_PULL * 2 * pull);
        const ty = gsap.utils.clamp(-MAX_PULL, MAX_PULL, (dy / reach) * MAX_PULL * 2 * pull);
        m.x += (tx - m.x) * 0.18;
        m.y += (ty - m.y) * 0.18;
        write(m);
      } else if (m.engaged) {
        m.engaged = false;
        // The spring back is the whole point: let it overshoot and settle.
        m.spring = gsap.to(m, {
          x: 0,
          y: 0,
          duration: 1.1,
          ease: 'elastic.out(1, 0.4)',
          onUpdate: () => write(m),
          onComplete: () => {
            m.spring = null;
          },
        });
      }
    }
  }

  /* ------------------------------------------------------------- events --- */

  function onPointerMove(e) {
    pos.x = e.clientX;
    pos.y = e.clientY;
    track(e);

    if (!revealed) {
      revealed = true;
      gsap.to([ring, dot], { opacity: 1, duration: 0.3 });
      gsap.to(spot, { opacity: 1, duration: 0.6 });
    }
  }

  function onOver(e) {
    const hit = e.target instanceof Element ? e.target.closest(HOVER_SELECTOR) : null;
    ring.classList.toggle('is-hover', Boolean(hit));
  }

  function onClick(e) {
    const el = document.createElement('div');
    el.className = 'ripple';
    el.style.left = `${e.clientX}px`;
    el.style.top = `${e.clientY}px`;
    document.body.appendChild(el);
    gsap.fromTo(
      el,
      { scale: 0, opacity: 0.9 },
      {
        scale: 1,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        onComplete: () => el.remove(),
      }
    );
  }

  function tick() {
    ringP.x += (pos.x - ringP.x) * 0.16;
    ringP.y += (pos.y - ringP.y) * 0.16;
    dotP.x += (pos.x - dotP.x) * 0.5;
    dotP.y += (pos.y - dotP.y) * 0.5;
    spotP.x += (pos.x - spotP.x) * 0.08;
    spotP.y += (pos.y - spotP.y) * 0.08;

    ring.style.transform = `translate3d(${ringP.x}px, ${ringP.y}px, 0)`;
    dot.style.transform = `translate3d(${dotP.x}px, ${dotP.y}px, 0)`;
    spot.style.transform = `translate3d(${spotP.x}px, ${spotP.y}px, 0)`;

    updateMagnets();
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('click', onClick, { passive: true });
  gsap.ticker.add(tick);

  return {
    refresh: registerMagnets,
    destroy() {
      gsap.ticker.remove(tick);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('click', onClick);
      ring.remove();
      dot.remove();
      spot.remove();
      document.documentElement.classList.remove('has-custom-cursor');
    },
  };
}
