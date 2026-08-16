# shubhamraut.com | The Compliance Architecture

A scroll-driven 3D portfolio for an AI governance / ISO implementation consultancy.
Vanilla JavaScript, Vite, Three.js, GSAP ScrollTrigger and Lenis. No framework.

## Running it

```bash
npm install
npm run dev      # dev server, opens automatically
npm run build    # production build → dist/
npm run preview  # serve the production build
```

`npm run gen:noise` regenerates `src/assets/textures/noise.png` (the film-grain
overlay). It's deterministic, so it's only needed if you want to change the grain.

## Structure

```
index.html              homepage, the full 3D experience
reference-build.html    Sentinel AI reference implementation
templates.html          filterable template library
playbooks.html          methodologies + 90-day roadmap timeline
wizard.html             scoping wizard placeholder
about.html              bio, credentials, contact

src/styles/main.css     the entire design system and every layout
src/js/
  main.js               entry point and boot order
  three-scene.js        the 3D scene: geometry, materials, lighting, render loop
  scroll-animations.js  Lenis, parallax depth layers, scroll-driven assembly, reveals
  cursor.js             custom cursor + the pointer feed the 3D scene tilts from
  loader.js             loading screen
  ui.js                 header, mobile menu, page transitions, accordion, filters
  env.js                shared capability/breakpoint probes
scripts/generate-noise.mjs   procedural PNG grain generator
```

## How it fits together

**Boot order** (`main.js`): the loading screen starts immediately and is gated on
a `ready` promise, so it can never dismiss before the scene behind it exists.
Shared chrome and smooth scrolling come up first, then the 3D scene is
**dynamically imported**. Three.js is a separate ~137 KB gzip chunk that only
the homepage on a wide viewport ever downloads. The other five pages load 52 KB
gzip total.

**The depth stage** spans the whole document rather than the viewport, so its
children sit at real page coordinates. Depth comes from a per-element offset
scrubbed across that element's own trip through the viewport. A single global
speed multiplier was the obvious approach and is wrong: it drifts elements
further off-screen the deeper they sit on the page.

**The assembly** is six independent scrubbed timelines, one per narrative
section, rather than one document-wide timeline. Anchoring each phase to the
section that narrates it means editing copy anywhere can't knock the crown into
the wrong place.

**The wiring effect** packs every control-to-control connection into one
`LineSegments` buffer, subdivided into short runs. `setDrawRange` walks that
buffer sequentially, so animating the range makes the lines draw themselves one
connection at a time, like a circuit wiring up, from a single draw call.

## Breakpoints

| Width | Behaviour |
|---|---|
| ≥ 1100px | Full 3D scene, parallax, custom cursor |
| 768–1099px | No 3D (structure and copy column would collide). CSS hero mark instead; parallax and cursor still on |
| < 768px | Mobile layout: no 3D, no cursor, no parallax; entrance animations still play |

`WEBGL_BREAKPOINT` in `env.js` and the `.webgl` / `.hero__mark` rules in
`main.css` must stay in sync.

## Accessibility

`prefers-reduced-motion` is honoured throughout: no smooth scroll, no parallax,
no scroll assembly (the structure renders fully built), no entrance fades, and
the loading screen shows a static lockup. Focus outlines are coral and never
removed. Pages render fully without JavaScript via the `no-js` class guard.
