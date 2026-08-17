# shubhamraut.com

Personal site for Shubham Raut, AI governance and ISO implementation consultant.

A scroll driven 3D experience built on the concept of **The Governed Core**: a
single sphere at the centre of a dark space, with thin framework rings locking
into orbit around it one at a time as the visitor scrolls. By the closing
section the structure is complete and everything resolves to coral.

## Stack

Vanilla JavaScript, no UI framework.

- [Vite](https://vite.dev) for the build, six HTML entry points
- [three.js](https://threejs.org) for the homepage scene
- [GSAP](https://gsap.com) + ScrollTrigger for all animation
- [Lenis](https://lenis.darkroom.engineering) for smooth scroll

## Commands

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # -> dist/
npm run preview   # serve the built output
```

## Layout

```
index.html              homepage, the full 3D experience
proof-of-work.html      Sentinel AI reference implementation
templates.html          filterable template library
playbooks.html          methodologies and the 12 week timeline
wizard.html             placeholder, no form logic yet
about.html              bio, credentials, contact

src/styles/main.css     tokens, layout, every component
src/js/main.js          boot, mobile and WebGL gating, the single render loop
src/js/loader.js        loading screen wired to real progress
src/js/scene.js         sphere, six rings, embers, fog, camera
src/js/scroll.js        Lenis + ScrollTrigger, all scroll animation
src/js/cursor.js        custom cursor, magnetics, spotlight, click ripple
src/js/glyphs.js        inline SVG glyph layer, parallax and cursor tilt
src/js/ui.js            nav, menu, accordions, filters, counters, marquee
```

## Conventions

- **No em dashes or en dashes in any visible copy.** Commas, periods, or plain
  hyphens only. This applies to every headline, paragraph, label, and button.
- Framework lists always lead with ISO/IEC 27001:2022, then ISO/IEC 42001:2023,
  then the EU AI Act, before anything else.
- Coral (`--coral`) is a spice, not a base. If a screen looks orange heavy,
  remove some.
- three.js never initialises below 768px. The hero falls back to a static SVG
  emblem there.
- Everything animated runs off a single `gsap.ticker`. Do not add a competing
  `requestAnimationFrame` loop.

## Deployment

Deployed on Vercel from `main`. Build command `npm run build`, output `dist`.
`vercel.json` pins that plus cache and security headers.

URLs are extensionless (`/proof-of-work`, not `/proof-of-work.html`) via Vercel's
`cleanUrls`. The `extensionlessPages` plugin in `vite.config.js` mirrors that in
dev and preview, so local and production routing behave identically. If you add
a page, add it to both the `rollupOptions.input` map and the `PAGES` array.

`/reference-build` is 301'd to `/proof-of-work`, which is what that page used to
be called.
