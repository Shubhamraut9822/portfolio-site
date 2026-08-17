import * as THREE from 'three';
import gsap from 'gsap';
import { playRingLock } from './sound.js';

const DEG = Math.PI / 180;

/**
 * The Governed Core.
 * One sphere, five framework rings that lock into orbit on scroll, embers and
 * haze that thin out as the structure completes.
 *
 * Each ring is dark brushed metal with a real specular response, carries a
 * billboarded name plaque that stays legible at any rotation, and is swept by
 * a travelling light that catches the metal once every few seconds.
 */
export const RINGS = [
  { code: 'ISO 27001', radius: 1.9,  rx: 78,  rz: 10,  speed: 0.0016, dir: 1,  sweep: 6.2, offset: 0.0 },
  { code: 'ISO 42001', radius: 2.35, rx: 20,  rz: 65,  speed: 0.0011, dir: -1, sweep: 7.4, offset: 1.3 },
  { code: 'EU AI ACT', radius: 2.8,  rx: 55,  rz: 130, speed: 0.0019, dir: 1,  sweep: 6.8, offset: 2.6 },
  { code: 'SOC 2',     radius: 3.2,  rx: 100, rz: 40,  speed: 0.0008, dir: 1,  sweep: 8.0, offset: 3.9 },
  { code: 'GDPR',      radius: 3.6,  rx: 35,  rz: 155, speed: 0.0014, dir: -1, sweep: 7.0, offset: 5.2 },
];

const OUTER_RADIUS = 3.6;
const FOG_MAX = 0.075;
const FOG_MIN = 0.012;
const EMBER_COUNT = 180;

// The core reads as a slow heartbeat, so the swing has to be wide. The peak is
// held just under 0.9 because above that the emissive saturates and the facets
// and specular highlight wash out, which flattens the very pulse it is meant
// to sell.
const EMISSIVE_LOW = 0.3;
const EMISSIVE_HIGH = 0.75;
const SHELL_LOW = 1.1;
const SHELL_HIGH = 1.16;

const CORAL_LIGHT_BASE = 7;
const SWEEP_LIGHT_BASE = 5;

const COLOR_OFF_WHITE = new THREE.Color('#F7F5F1');
const COLOR_CORAL = new THREE.Color('#FF5436');
const COLOR_METAL = new THREE.Color('#1a1a1f');

const emberVert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aFade;

  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uProgress;
  uniform float uFogDensity;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(-mv.z, 0.001);

    float alive = 1.0;
    if (aFade > 0.0) {
      alive = 1.0 - smoothstep(aFade - 0.28, aFade, uProgress);
    }

    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    vAlpha = alive * (1.0 - fogFactor);

    gl_PointSize = aSize * uSizeScale * uPixelRatio / dist;
    gl_Position = projectionMatrix * mv;
  }
`;

const emberFrag = /* glsl */ `
  uniform float uOpacity;
  uniform float uBright;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * uBright, falloff * vAlpha * uOpacity);
  }
`;

/** Rounded, glass like plaque carrying the framework name. */
function makePlaqueTexture(code) {
  const h = 160;
  const w = Math.round(96 * code.length + 150);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const r = 34;
  const pad = 6;
  ctx.clearRect(0, 0, w, h);

  ctx.beginPath();
  ctx.moveTo(pad + r, pad);
  ctx.lineTo(w - pad - r, pad);
  ctx.quadraticCurveTo(w - pad, pad, w - pad, pad + r);
  ctx.lineTo(w - pad, h - pad - r);
  ctx.quadraticCurveTo(w - pad, h - pad, w - pad - r, h - pad);
  ctx.lineTo(pad + r, h - pad);
  ctx.quadraticCurveTo(pad, h - pad, pad, h - pad - r);
  ctx.lineTo(pad, pad + r);
  ctx.quadraticCurveTo(pad, pad, pad + r, pad);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(30, 30, 36, 0.82)');
  grad.addColorStop(1, 'rgba(12, 12, 15, 0.88)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 84, 54, 0.5)';
  ctx.stroke();

  ctx.font = '500 62px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = '#F7F5F1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, w / 2, h / 2 + 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return { tex, aspect: w / h };
}

export function createScene({ canvas }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0b, FOG_MAX);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  // ---------------------------------------------------------------- core ---
  const core = new THREE.Group();
  scene.add(core);

  const sphereGeo = new THREE.IcosahedronGeometry(1.05, 4);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x141419,
    roughness: 0.42,
    metalness: 0.25,
    emissive: COLOR_CORAL.clone(),
    emissiveIntensity: EMISSIVE_LOW,
    flatShading: true,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  core.add(sphere);

  const shellGeo = new THREE.IcosahedronGeometry(1.05, 4);
  const shellMat = new THREE.MeshBasicMaterial({
    color: COLOR_CORAL.clone(),
    transparent: true,
    opacity: 0.05,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.scale.setScalar(SHELL_LOW);
  core.add(shell);

  // --------------------------------------------------------------- rings ---
  const ringGroup = new THREE.Group();
  core.add(ringGroup);

  const tmpVec = new THREE.Vector3();

  const rings = RINGS.map((def) => {
    // Thicker than a hairline on purpose: brushed metal needs some surface for
    // the specular highlight and the light sweep to actually land on.
    const geo = new THREE.TorusGeometry(def.radius, 0.016, 14, 220);
    const mat = new THREE.MeshStandardMaterial({
      color: COLOR_METAL.clone(),
      metalness: 0.65,
      roughness: 0.22,
      emissive: COLOR_OFF_WHITE.clone(),
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(def.rx * DEG, 0, def.rz * DEG);
    mesh.scale.setScalar(1.6);
    mesh.visible = false;
    ringGroup.add(mesh);

    // The fixed orbital plane, used to place the plaque and the sweep. The
    // ring mesh itself keeps spinning inside this plane.
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(def.rx * DEG, 0, def.rz * DEG));

    const { tex, aspect } = makePlaqueTexture(def.code);
    const plaqueH = 0.3;
    const plaqueGeo = new THREE.PlaneGeometry(plaqueH * aspect, plaqueH);
    const plaqueMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.visible = false;
    ringGroup.add(plaque);

    // Travelling glint: a visible spark plus the light that makes the metal
    // flare as it passes.
    const glintGeo = new THREE.SphereGeometry(0.032, 10, 10);
    const glintMat = new THREE.MeshBasicMaterial({
      color: 0xfff1ec,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glint = new THREE.Mesh(glintGeo, glintMat);
    glint.visible = false;
    ringGroup.add(glint);

    const sweepLight = new THREE.PointLight(0xffd9cc, 0, 1.5, 2);
    ringGroup.add(sweepLight);

    return {
      def,
      mesh,
      mat,
      geo,
      tilt,
      plaque,
      plaqueMat,
      plaqueGeo,
      tex,
      glint,
      glintMat,
      glintGeo,
      sweepLight,
      spin: 0,
      revealed: false,
    };
  });

  /** Point on a ring's orbit, expressed in ringGroup space. */
  function orbitPoint(ring, angle, out) {
    out.set(Math.cos(angle) * ring.def.radius, Math.sin(angle) * ring.def.radius, 0);
    out.applyQuaternion(ring.tilt);
    return out;
  }

  // -------------------------------------------------------------- embers ---
  const emberGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(EMBER_COUNT * 3);
  const colors = new Float32Array(EMBER_COUNT * 3);
  const sizes = new Float32Array(EMBER_COUNT);
  const fades = new Float32Array(EMBER_COUNT);

  const base = new Float32Array(EMBER_COUNT * 3);
  const drift = new Float32Array(EMBER_COUNT * 3);
  const disp = new Float32Array(EMBER_COUNT * 3);
  const phase = new Float32Array(EMBER_COUNT);

  const EMBER_R = 7;

  for (let i = 0; i < EMBER_COUNT; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = EMBER_R * Math.cbrt(Math.random());

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    base[i * 3] = positions[i * 3] = x;
    base[i * 3 + 1] = positions[i * 3 + 1] = y;
    base[i * 3 + 2] = positions[i * 3 + 2] = z;

    // Incense smoke in still air: mostly up, a little sideways, never fast.
    drift[i * 3] = (Math.random() - 0.5) * 0.1;
    drift[i * 3 + 1] = 0.1 + Math.random() * 0.18;
    drift[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    phase[i] = Math.random() * Math.PI * 2;

    const c = Math.random() < 0.3 ? COLOR_CORAL : COLOR_OFF_WHITE;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    sizes[i] = 0.012 + Math.random() * 0.018;
    // Roughly half the field burns off as the structure completes.
    fades[i] = Math.random() < 0.55 ? 0.25 + Math.random() * 0.7 : 0;
  }

  emberGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  emberGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  emberGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  emberGeo.setAttribute('aFade', new THREE.BufferAttribute(fades, 1));

  const emberMat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: 1 },
      uSizeScale: { value: 900 },
      uProgress: { value: 0 },
      uOpacity: { value: 0.5 },
      uBright: { value: 1 },
      uFogDensity: { value: FOG_MAX },
    },
    vertexShader: emberVert,
    fragmentShader: emberFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const embers = new THREE.Points(emberGeo, emberMat);
  scene.add(embers);

  // ----------------------------------------------------------- shockwave ---
  const shockGeo = new THREE.RingGeometry(0.86, 1, 96);
  const shockMat = new THREE.MeshBasicMaterial({
    color: COLOR_CORAL.clone(),
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shock = new THREE.Mesh(shockGeo, shockMat);
  shock.scale.setScalar(0.2);
  scene.add(shock);

  // ------------------------------------------------------------- lighting ---
  const ambient = new THREE.AmbientLight(0xfff4ec, 0.16);
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(5, 7, 4);
  const coralLight = new THREE.PointLight(0xff5436, CORAL_LIGHT_BASE, 14);
  coralLight.position.set(1.2, 0.6, 2.2);
  const rim = new THREE.DirectionalLight(0x4a7fd9, 0.45);
  rim.position.set(-4, -2.5, -5);
  scene.add(ambient, key, coralLight, rim);

  // ----------------------------------------------------------------- state ---
  const cam = { radius: 26, azimuth: -0.3, height: 0.4, shift: 2.6, restRadius: 12 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };
  const tiltMax = 1.8 * DEG;
  const state = { scroll: 0, finale: 0, coralBase: CORAL_LIGHT_BASE };

  const ray = new THREE.Raycaster();
  const pushPoint = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  let clock = 0;

  /**
   * Framing is solved rather than hard coded. The copy column is measured from
   * the DOM, then the assembly is sized and offset so it always clears that
   * column by a real gap. Text is never touched to make room.
   */
  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    const halfFov = Math.tan((45 * DEG) / 2);

    let ringScale = 1;
    let gapPx = 80;

    if (w < 1024) {
      ringScale = 0.8;
      gapPx = 0;
    } else if (w < 1280) {
      gapPx = 56;
    } else if (w < 1680) {
      gapPx = 80;
    } else {
      // Ample room on a large monitor, so the instrument can breathe wider.
      ringScale = 1.1;
      gapPx = 120;
    }

    ringGroup.scale.setScalar(ringScale);
    const outer = OUTER_RADIUS * ringScale;

    if (w < 1024) {
      // Centred composition, no copy column to clear.
      cam.shift = 0;
      const needW = (outer + 0.6) / (halfFov * aspect);
      const needH = (outer + 0.5) / halfFov;
      cam.restRadius = THREE.MathUtils.clamp(Math.max(needW, needH), 9, 24);
    } else {
      const col = document.querySelector('.hero .home-col');
      const textRight = col ? col.getBoundingClientRect().right : w * 0.47;
      const marginRight = 30;

      // Pixels per world unit that let the whole assembly sit in the space
      // remaining to the right of the copy, with the gap intact.
      const avail = Math.max(160, w - textRight - gapPx - marginRight);
      let k = avail / (2 * outer);
      k = Math.min(k, (h / 2 - 34) / outer);
      k = THREE.MathUtils.clamp(k, 40, 170);

      const centreX = textRight + gapPx + outer * k;
      cam.shift = (centreX - w / 2) / k;
      cam.restRadius = THREE.MathUtils.clamp(h / 2 / (k * halfFov), 9, 30);
    }

    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    // Published so the framing can be inspected and asserted on without
    // resorting to pixel readback.
    const pxPerWorld = h / 2 / (cam.restRadius * halfFov);
    canvas.dataset.framing = JSON.stringify({
      shift: Number(cam.shift.toFixed(3)),
      radius: Number(cam.restRadius.toFixed(3)),
      ringScale,
      outer: Number(outer.toFixed(3)),
      pxPerWorld: Number(pxPerWorld.toFixed(2)),
      assemblyLeftPx: Math.round(w / 2 + (cam.shift - outer) * pxPerWorld),
      assemblyRightPx: Math.round(w / 2 + (cam.shift + outer) * pxPerWorld),
    });

    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    emberMat.uniforms.uPixelRatio.value = dpr;
    // Projection scale, boosted so a 0.02 unit mote still reads as a soft glow.
    emberMat.uniforms.uSizeScale.value = (h / (2 * halfFov)) * 3;
  }

  layout();
  cam.radius = cam.restRadius * 2.2;

  function updateCamera() {
    const a = cam.azimuth;
    camera.position.set(Math.sin(a) * cam.radius, cam.height, Math.cos(a) * cam.radius);
    camera.lookAt(0, 0, 0);
    camera.rotateY(-pointer.x * tiltMax);
    camera.rotateX(pointer.y * tiltMax);
    // Slide the camera sideways so the assembly sits right of the copy column.
    camera.translateX(-cam.shift);
  }

  function updateEmbers(dt) {
    const pos = emberGeo.attributes.position.array;

    for (let i = 0; i < EMBER_COUNT; i += 1) {
      const i3 = i * 3;

      base[i3] += (drift[i3] + Math.sin(clock * 0.22 + phase[i]) * 0.05) * dt;
      base[i3 + 1] += drift[i3 + 1] * dt;
      base[i3 + 2] += (drift[i3 + 2] + Math.cos(clock * 0.18 + phase[i]) * 0.05) * dt;

      if (base[i3 + 1] > EMBER_R) base[i3 + 1] = -EMBER_R;
      if (base[i3] > EMBER_R) base[i3] = -EMBER_R;
      if (base[i3] < -EMBER_R) base[i3] = EMBER_R;
      if (base[i3 + 2] > EMBER_R) base[i3 + 2] = -EMBER_R;
      if (base[i3 + 2] < -EMBER_R) base[i3 + 2] = EMBER_R;

      // Cursor disturbance eases back over roughly two seconds.
      disp[i3] *= 0.982;
      disp[i3 + 1] *= 0.982;
      disp[i3 + 2] *= 0.982;

      pos[i3] = base[i3] + disp[i3];
      pos[i3 + 1] = base[i3 + 1] + disp[i3 + 1];
      pos[i3 + 2] = base[i3 + 2] + disp[i3 + 2];
    }

    emberGeo.attributes.position.needsUpdate = true;
  }

  function disturb() {
    if (!pointer.active) return;
    ray.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
    pushPoint.copy(ray.ray.origin).addScaledVector(ray.ray.direction, cam.radius);

    const R = 2.4;
    for (let i = 0; i < EMBER_COUNT; i += 1) {
      const i3 = i * 3;
      tmp.set(base[i3] + disp[i3], base[i3 + 1] + disp[i3 + 1], base[i3 + 2] + disp[i3 + 2]);
      tmp.sub(pushPoint);
      const d = tmp.length();
      if (d > 0.001 && d < R) {
        const force = (1 - d / R) * 0.028;
        tmp.multiplyScalar(force / d);
        disp[i3] += tmp.x;
        disp[i3 + 1] += tmp.y;
        disp[i3 + 2] += tmp.z;
      }
    }
  }

  function applyFinale() {
    const t = state.finale;
    rings.forEach((r) => {
      // The metal warms toward coral and starts to carry its own light.
      r.mat.color.copy(COLOR_METAL).lerp(COLOR_CORAL, t * 0.55);
      r.mat.emissive.copy(COLOR_OFF_WHITE).lerp(COLOR_CORAL, t);
      r.mat.emissiveIntensity = 0.05 + t * 0.5;
      if (r.revealed) r.plaqueMat.opacity = 0.85 + t * 0.15;
    });
    shellMat.opacity = 0.05 + 0.05 * t;
    emberMat.uniforms.uBright.value = 1 + t * 0.9;
  }

  // ------------------------------------------------------------ public API ---

  function render(dt) {
    clock += dt;

    sphere.rotation.y += 0.0015;
    shell.rotation.y += 0.0015;

    // Resting heartbeat on a four second cycle, wide enough to actually read.
    const pulse = 0.5 + 0.5 * Math.sin((clock / 4) * Math.PI * 2);
    sphereMat.emissiveIntensity =
      (EMISSIVE_LOW + (EMISSIVE_HIGH - EMISSIVE_LOW) * pulse) * (1 + state.finale * 0.6);
    shell.scale.setScalar(SHELL_LOW + (SHELL_HIGH - SHELL_LOW) * pulse);

    rings.forEach((r) => {
      if (!r.revealed) return;

      const step = r.def.speed * r.def.dir * (dt * 60);
      r.spin += step;
      r.mesh.rotateZ(step);

      // The plaque orbits with its ring but always faces the camera, so the
      // name never turns sideways or upside down.
      orbitPoint(r, r.spin + r.def.offset, tmpVec);
      r.plaque.position.copy(tmpVec);
      r.plaque.quaternion.copy(camera.quaternion);

      // A quick sweep round the circumference, out of phase with its neighbours.
      const sweepAngle = (clock / r.def.sweep) * Math.PI * 2 + r.def.offset;
      orbitPoint(r, sweepAngle, tmpVec);
      r.glint.position.copy(tmpVec);
      r.sweepLight.position.copy(tmpVec);

      // Flare hardest on the arc nearest the camera, so it reads as a glint
      // catching the metal rather than a lamp orbiting the ring.
      const facing = 0.5 + 0.5 * Math.cos(sweepAngle);
      r.glintMat.opacity = 0.3 + facing * 0.6;
      r.sweepLight.intensity = SWEEP_LIGHT_BASE * (0.3 + facing);
    });

    disturb();
    updateEmbers(dt);

    // The coral light leans in when the pointer nears the centre of the frame.
    const centreness = pointer.active ? 1 - Math.min(1, Math.hypot(pointer.x, pointer.y)) : 0;
    coralLight.intensity = state.coralBase * (1 + centreness * 0.35);

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;

    updateCamera();

    if (shockMat.opacity > 0) shock.quaternion.copy(camera.quaternion);

    renderer.render(scene, camera);
  }

  function setPointer(nx, ny) {
    pointer.tx = nx;
    pointer.ty = ny;
    pointer.active = true;
  }

  /** Scroll progress across the whole page, 0 to 1. Drives orbit and clarity. */
  function setScrollProgress(p) {
    state.scroll = p;
    cam.azimuth = -0.3 + p * 0.61;
    cam.height = 0.4 - p * 0.7;
    const density = FOG_MAX + (FOG_MIN - FOG_MAX) * p;
    scene.fog.density = density;
    emberMat.uniforms.uFogDensity.value = density;
    emberMat.uniforms.uProgress.value = p;
  }

  function revealRing(index, immediate = false) {
    const r = rings[index];
    if (!r || r.revealed) return;
    r.revealed = true;
    r.mesh.visible = true;
    r.plaque.visible = true;
    r.glint.visible = true;

    if (immediate) {
      r.mesh.scale.setScalar(1);
      r.mat.opacity = 1;
      r.plaqueMat.opacity = 0.85;
      applyFinale();
      return;
    }

    playRingLock();

    gsap.fromTo(
      r.mesh.scale,
      { x: 1.6, y: 1.6, z: 1.6 },
      { x: 1, y: 1, z: 1, duration: 0.7, ease: 'power3.out' }
    );
    gsap.fromTo(r.mat, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power3.out' });
    gsap.fromTo(r.plaqueMat, { opacity: 0 }, { opacity: 0.85, duration: 0.9, ease: 'power2.out' });
  }

  function flash() {
    shock.position.set(0, 0, 0);
    shock.scale.setScalar(0.2);
    shockMat.opacity = 0.9;
    gsap.to(shock.scale, { x: 6, y: 6, z: 6, duration: 0.45, ease: 'power2.out' });
    gsap.to(shockMat, { opacity: 0, duration: 0.45, ease: 'power2.out' });

    gsap.fromTo(
      state,
      { coralBase: CORAL_LIGHT_BASE * 2.5 },
      { coralBase: CORAL_LIGHT_BASE, duration: 0.6, ease: 'power2.out' }
    );

    // Brief outward impulse on the ember field.
    for (let i = 0; i < EMBER_COUNT; i += 1) {
      const i3 = i * 3;
      tmp.set(base[i3], base[i3 + 1], base[i3 + 2]);
      const d = Math.max(tmp.length(), 0.001);
      tmp.multiplyScalar(0.5 / d);
      disp[i3] += tmp.x;
      disp[i3 + 1] += tmp.y;
      disp[i3 + 2] += tmp.z;
    }
  }

  /** Camera push in, flash, first ring. onFlash fires on the exact beat. */
  function heroEntrance({ onFlash } = {}) {
    const tl = gsap.timeline();
    cam.radius = cam.restRadius * 2.2;

    tl.to(cam, { radius: cam.restRadius, duration: 1.1, ease: 'power3.inOut' }, 0.5);

    tl.add(() => {
      flash();
      revealRing(0);
      if (onFlash) onFlash();
    }, 1.45);

    return tl;
  }

  /** No new ring here. The five that exist resolve together into coral. */
  function runFinale() {
    gsap.to(state, {
      finale: 1,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: applyFinale,
    });
    gsap.to(emberMat.uniforms.uOpacity, { value: 0.75, duration: 1.2, ease: 'power2.inOut' });
  }

  /** Reduced motion: show the completed structure, no theatre. */
  function assembleInstantly() {
    rings.forEach((_, i) => revealRing(i, true));
    setScrollProgress(1);
    cam.radius = cam.restRadius;
    state.finale = 1;
    applyFinale();
    emberMat.uniforms.uOpacity.value = 0.75;
    updateCamera();

    rings.forEach((r) => {
      orbitPoint(r, r.def.offset, tmpVec);
      r.plaque.position.copy(tmpVec);
      r.plaque.quaternion.copy(camera.quaternion);
      orbitPoint(r, r.def.offset + 0.8, tmpVec);
      r.glint.position.copy(tmpVec);
      r.sweepLight.position.copy(tmpVec);
      r.sweepLight.intensity = SWEEP_LIGHT_BASE * 0.6;
      r.glintMat.opacity = 0.6;
    });

    renderer.render(scene, camera);
  }

  function dispose() {
    rings.forEach((r) => {
      r.geo.dispose();
      r.mat.dispose();
      r.plaqueGeo.dispose();
      r.plaqueMat.dispose();
      r.tex.dispose();
      r.glintGeo.dispose();
      r.glintMat.dispose();
    });
    sphereGeo.dispose();
    shellGeo.dispose();
    sphereMat.dispose();
    shellMat.dispose();
    emberGeo.dispose();
    emberMat.dispose();
    shockGeo.dispose();
    shockMat.dispose();
    renderer.dispose();
  }

  return {
    render,
    resize: layout,
    setPointer,
    setScrollProgress,
    revealRing,
    heroEntrance,
    runFinale,
    assembleInstantly,
    dispose,
    get restRadius() {
      return cam.restRadius;
    },
  };
}
