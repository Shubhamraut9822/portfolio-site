import * as THREE from 'three';
import gsap from 'gsap';

const DEG = Math.PI / 180;

/**
 * The Governed Core.
 * One sphere, six framework rings that lock into orbit on scroll, embers and
 * haze that thin out as the structure completes.
 */
export const RINGS = [
  { code: 'ISO/IEC 27001:2022', radius: 1.9,  rx: 78,  rz: 10,  speed: 0.0016, dir: 1 },
  { code: 'ISO/IEC 42001:2023', radius: 2.35, rx: 20,  rz: 65,  speed: 0.0011, dir: -1 },
  { code: 'EU AI ACT',          radius: 2.8,  rx: 55,  rz: 130, speed: 0.0019, dir: 1 },
  { code: 'SOC 2',              radius: 3.2,  rx: 100, rz: 40,  speed: 0.0008, dir: 1 },
  { code: 'GDPR',               radius: 3.6,  rx: 35,  rz: 155, speed: 0.0014, dir: -1 },
  { code: 'DPDPA',              radius: 4.0,  rx: 68,  rz: 95,  speed: 0.0010, dir: 1 },
];

const FOG_MAX = 0.075;
const FOG_MIN = 0.012;
const EMBER_COUNT = 180;
const RING_BASE_OPACITY = 0.42;

const COLOR_RING = new THREE.Color('#F7F5F1');
const COLOR_CORAL = new THREE.Color('#FF5436');

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

function makeLabelTexture(code, repeats) {
  const w = 2048;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.font = '500 24px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = '#F7F5F1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const slot = w / repeats;
  for (let i = 0; i < repeats; i += 1) {
    ctx.fillText(code, (i + 0.5) * slot, h / 2 + 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
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

  // Low emissive on purpose: the core is a dark body lit from within, not a
  // glowing red planet. Most of its colour comes from the coral point light.
  const EMISSIVE_BASE = 0.045;

  const sphereGeo = new THREE.IcosahedronGeometry(1.05, 4);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x141419,
    roughness: 0.42,
    metalness: 0.25,
    emissive: COLOR_CORAL.clone(),
    emissiveIntensity: EMISSIVE_BASE,
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
  shell.scale.setScalar(1.12);
  core.add(shell);

  // --------------------------------------------------------------- rings ---
  const ringGroup = new THREE.Group();
  core.add(ringGroup);

  const rings = RINGS.map((def) => {
    const geo = new THREE.TorusGeometry(def.radius, 0.006, 12, 200);
    const mat = new THREE.MeshBasicMaterial({
      color: COLOR_RING.clone(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(def.rx * DEG, 0, def.rz * DEG);
    mesh.scale.setScalar(1.6);
    mesh.visible = false;

    // Etched calibration marks around the circumference.
    const repeats = Math.max(10, Math.round(def.radius * 7));
    const tex = makeLabelTexture(def.code, repeats);
    const labelGeo = new THREE.TorusGeometry(def.radius, 0.052, 4, 240);
    const labelMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      color: COLOR_RING.clone(),
    });
    const label = new THREE.Mesh(labelGeo, labelMat);
    mesh.add(label);

    ringGroup.add(mesh);
    return { def, mesh, mat, label, labelMat, tex, geo, labelGeo, revealed: false, spin: 0 };
  });

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
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = EMBER_R * Math.cbrt(Math.random());

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    base[i * 3] = positions[i * 3] = x;
    base[i * 3 + 1] = positions[i * 3 + 1] = y;
    base[i * 3 + 2] = positions[i * 3 + 2] = z;

    // Incense smoke in still air: mostly up, a little sideways, never fast.
    drift[i * 3] = (Math.random() - 0.5) * 0.10;
    drift[i * 3 + 1] = 0.10 + Math.random() * 0.18;
    drift[i * 3 + 2] = (Math.random() - 0.5) * 0.10;
    phase[i] = Math.random() * Math.PI * 2;

    const warm = Math.random() < 0.3;
    const c = warm ? COLOR_CORAL : COLOR_RING;
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

  // ------------------------------------------------------------ shockwave ---
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
  // Point lights are in candela since three r155, so the nominal 0.9 becomes
  // this once divided by the squared distance to the core.
  const CORAL_LIGHT_BASE = 7;
  const coralLight = new THREE.PointLight(0xff5436, CORAL_LIGHT_BASE, 14);
  coralLight.position.set(1.2, 0.6, 2.2);
  const rim = new THREE.DirectionalLight(0x4a7fd9, 0.45);
  rim.position.set(-4, -2.5, -5);
  scene.add(ambient, key, coralLight, rim);

  // ----------------------------------------------------------------- state ---
  const cam = {
    radius: 24,
    azimuth: -0.30,
    height: 0.4,
    shift: 2.6,
    restRadius: 11,
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };
  const tiltMax = 1.8 * DEG;

  const state = {
    scroll: 0,
    finale: 0,
    emberBright: 1,
    coralBase: CORAL_LIGHT_BASE,
  };

  const ray = new THREE.Raycaster();
  const pushPoint = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  let clock = 0;

  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;

    const tablet = w < 1024;
    cam.shift = tablet ? 0 : 2.6;
    ringGroup.scale.setScalar(tablet ? 0.8 : 1);

    const outer = 4.0 * (tablet ? 0.8 : 1);
    const halfFov = Math.tan((45 * DEG) / 2);
    const needW = (outer + cam.shift + 0.6) / (halfFov * aspect);
    const needH = (outer + 0.5) / halfFov;
    cam.restRadius = THREE.MathUtils.clamp(Math.max(needW, needH), 9, 22);

    camera.aspect = aspect;
    camera.updateProjectionMatrix();

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
      r.mat.color.copy(COLOR_RING).lerp(COLOR_CORAL, t);
      r.labelMat.color.copy(COLOR_RING).lerp(COLOR_CORAL, t);
      if (r.revealed) {
        r.mat.opacity = RING_BASE_OPACITY + (0.7 - RING_BASE_OPACITY) * t;
        r.labelMat.opacity = 0.3 + 0.25 * t;
      }
    });
    sphereMat.emissiveIntensity = EMISSIVE_BASE * (1 + t);
    shellMat.opacity = 0.05 + 0.05 * t;
    emberMat.uniforms.uBright.value = 1 + t * 0.9;
  }

  // ------------------------------------------------------------ public API ---

  function render(dt) {
    clock += dt;

    sphere.rotation.y += 0.0015;
    shell.rotation.y += 0.0015;

    // Resting heartbeat on a four second cycle.
    const pulse = 0.5 + 0.5 * Math.sin((clock / 4) * Math.PI * 2);
    sphereMat.emissiveIntensity = EMISSIVE_BASE * (1 + state.finale) * (0.78 + pulse * 0.44);

    rings.forEach((r) => {
      if (!r.revealed) return;
      r.mesh.rotateZ(r.def.speed * r.def.dir * (dt * 60));
    });

    disturb();
    updateEmbers(dt);

    // The coral light leans in when the pointer nears the centre of the frame.
    const centreness = pointer.active
      ? 1 - Math.min(1, Math.hypot(pointer.x, pointer.y))
      : 0;
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
    cam.azimuth = -0.30 + p * 0.61;
    cam.height = 0.4 - p * 0.7;
    const density = FOG_MAX + (FOG_MIN - FOG_MAX) * p;
    scene.fog.density = density;
    emberMat.uniforms.uFogDensity.value = density;
    emberMat.uniforms.uProgress.value = p;
  }

  function setCameraRadius(r) {
    cam.radius = r;
  }

  function revealRing(index, immediate = false) {
    const r = rings[index];
    if (!r || r.revealed) return;
    r.revealed = true;
    r.mesh.visible = true;

    if (immediate) {
      r.mesh.scale.setScalar(1);
      r.mat.opacity = RING_BASE_OPACITY;
      r.labelMat.opacity = 0.3;
      applyFinale();
      return;
    }

    gsap.fromTo(
      r.mesh.scale,
      { x: 1.6, y: 1.6, z: 1.6 },
      { x: 1, y: 1, z: 1, duration: 0.7, ease: 'power3.out' }
    );
    gsap.fromTo(r.mat, { opacity: 0 }, { opacity: RING_BASE_OPACITY, duration: 0.7, ease: 'power3.out' });
    gsap.fromTo(r.labelMat, { opacity: 0 }, { opacity: 0.3, duration: 0.9, ease: 'power2.out' });
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

    tl.to(cam, {
      radius: cam.restRadius,
      duration: 1.1,
      ease: 'power3.inOut',
    }, 0.5);

    tl.add(() => {
      flash();
      revealRing(0);
      if (onFlash) onFlash();
    }, 1.45);

    return tl;
  }

  function runFinale() {
    // Ring six locks in first, then the whole structure resolves to coral.
    revealRing(5);
    gsap.to(state, {
      finale: 1,
      duration: 1.2,
      delay: 0.55,
      ease: 'power2.inOut',
      onUpdate: applyFinale,
    });
    gsap.to(emberMat.uniforms.uOpacity, {
      value: 0.75,
      duration: 1.2,
      delay: 0.55,
      ease: 'power2.inOut',
    });
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
    renderer.render(scene, camera);
  }

  function dispose() {
    rings.forEach((r) => {
      r.geo.dispose();
      r.labelGeo.dispose();
      r.mat.dispose();
      r.labelMat.dispose();
      r.tex.dispose();
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
    setCameraRadius,
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
