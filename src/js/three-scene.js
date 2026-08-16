/**
 * "The Compliance Architecture": the persistent 3D scene behind the homepage.
 *
 * A layered geometric structure that assembles itself as the visitor scrolls:
 * foundation → pillars → risk platform → control blocks → connecting lines →
 * crown. Every part is authored from primitive geometry; nothing is loaded from
 * disk, so the whole thing boots in a few milliseconds.
 *
 * This module owns the scene graph, materials, lighting and render loop, and
 * exposes the individual parts so scroll-animations.js can drive assembly.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { canRender3D, prefersReducedMotion, supportsWebGL, WEBGL_BREAKPOINT } from './env.js';

const COLORS = {
  structure: 0x1a1a2e,
  coral: 0xff5436,
  rim: 0x4a90d9,
  offWhite: 0xf7f5f1,
};

/** World-space X offset that keeps the structure clear of the copy column. */
const DESKTOP_OFFSET_X = 2.8;

/* -------------------------------------------------------------------------- */
/* Procedural textures                                                        */
/* -------------------------------------------------------------------------- */

/** Soft round sprite for the drifting particles, generated and never fetched. */
function createParticleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* -------------------------------------------------------------------------- */
/* Structure builders                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The structure's shared surface: dark blue-charcoal that reveals itself along
 * the edges and highlights. Used for the pillars and control blocks, which the
 * camera only ever sees edge-on.
 */
function makeStructureMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: COLORS.structure,
    roughness: 0.35,
    metalness: 0.1,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    reflectivity: 0.4,
    envMapIntensity: 0.4,
  });
}

/**
 * The horizontal plates need their own, far more matte treatment.
 *
 * They present a large flat top face to both the camera and the overhead key
 * light, so the glossy settings above turn them into near-white slabs and the
 * charcoal palette collapses. Killing the clearcoat and most of the specular
 * keeps them reading as dark stone; their edge outlines do the shape-defining.
 */
function makePlateMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: COLORS.structure,
    roughness: 0.95,
    metalness: 0,
    clearcoat: 0,
    reflectivity: 0.02,
    envMapIntensity: 0.05,
  });
}

/** Adds a faint wireframe outline over a mesh so edges read against the dark bg. */
function addEdges(mesh, color = COLORS.offWhite, opacity = 0.14) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.add(edges);
  return edges;
}

/** Layer 1: the governance foundation. */
function buildFoundation() {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 2.5), makePlateMaterial());
  plate.material.transparent = true;
  plate.material.opacity = 0.82;
  // The foundation carries the hero alone, so its outline runs brighter than
  // the layers that arrive later with company.
  addEdges(plate, COLORS.offWhite, 0.38);
  group.add(plate);
  group.userData.baseY = -1.6;
  group.position.y = group.userData.baseY;
  return group;
}

/** Layer 2: four core pillars at the corners of the base. */
function buildPillars(material) {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(0.15, 1.8, 0.15);
  const corners = [
    [-1.75, 1.05],
    [1.75, 1.05],
    [-1.75, -1.05],
    [1.75, -1.05],
  ];

  corners.forEach(([x, z]) => {
    const pillar = new THREE.Mesh(geometry, material.clone());
    pillar.position.set(x, 0, z);
    addEdges(pillar, COLORS.offWhite, 0.16);
    group.add(pillar);
  });

  // Pillars sit on top of the foundation plate.
  group.userData.baseY = -0.62;
  group.position.y = group.userData.baseY;
  return group;
}

/** Layer 3: the risk assessment platform, floating between the pillars. */
function buildRiskLayer() {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 2), makePlateMaterial());
  plate.material.transparent = true;
  plate.material.opacity = 0.9;
  addEdges(plate, COLORS.coral, 0.35);
  group.add(plate);
  // ~40% of the way up the pillars (which span -1.52 → 0.28).
  group.userData.baseY = -0.3;
  group.position.y = group.userData.baseY;
  return group;
}

/**
 * Layer 4: eight control blocks in a 4×2 grid on the risk platform.
 * Returns the group plus the grid positions so the connecting lines can be
 * generated from the exact same coordinates.
 */
function buildControlBlocks(material) {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const positions = [];

  const cols = 4;
  const rows = 2;
  const spacingX = 0.78;
  const spacingZ = 0.66;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col - (cols - 1) / 2) * spacingX;
      const z = (row - (rows - 1) / 2) * spacingZ;
      const block = new THREE.Mesh(geometry, material.clone());
      block.position.set(x, 0, z);
      addEdges(block, COLORS.coral, 0.3);
      group.add(block);
      positions.push(new THREE.Vector3(x, 0, z));
    }
  }

  // Resting on the risk platform: plate top (-0.25) + half a cube.
  group.userData.baseY = -0.1;
  group.userData.positions = positions;
  group.position.y = group.userData.baseY;
  return group;
}

/**
 * Layer 5: the control relationship wiring.
 *
 * Every connection is subdivided into short sub-segments packed into a single
 * LineSegments buffer. Because `setDrawRange` walks that buffer sequentially,
 * animating the range makes the lines *draw themselves* one run at a time,
 * like a circuit wiring up, from a single draw call.
 */
function buildConnections(blockPositions, blockBaseY) {
  const SUBDIVISIONS = 8;
  const pairs = [];

  // Chain neighbouring controls along each row.
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      pairs.push([row * 4 + col, row * 4 + col + 1]);
    }
  }
  // Stitch the two rows together.
  for (let col = 0; col < 4; col++) pairs.push([col, col + 4]);
  // Two diagonals for visual interest.
  pairs.push([0, 5], [2, 7]);

  const vertices = [];
  const push = (v) => vertices.push(v.x, v.y, v.z);

  pairs.forEach(([a, b]) => {
    const from = blockPositions[a].clone().setY(blockBaseY);
    const to = blockPositions[b].clone().setY(blockBaseY);
    for (let i = 0; i < SUBDIVISIONS; i++) {
      push(from.clone().lerp(to, i / SUBDIVISIONS));
      push(from.clone().lerp(to, (i + 1) / SUBDIVISIONS));
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  const material = new THREE.LineBasicMaterial({
    color: COLORS.coral,
    transparent: true,
    opacity: 0.55,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.userData.vertexCount = vertices.length / 3;
  lines.geometry.setDrawRange(0, 0);
  return lines;
}

/** Layer 6: the crown, for certification and audit readiness. */
function buildCrown() {
  const group = new THREE.Group();

  const wire = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5, 0),
    new THREE.MeshBasicMaterial({ color: COLORS.coral, wireframe: true })
  );

  // A slightly larger additive shell reads as an emissive halo.
  const halo = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.56, 0),
    new THREE.MeshBasicMaterial({
      color: COLORS.coral,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  group.add(wire, halo);
  group.userData.baseY = 1.35;
  group.userData.wire = wire;
  group.userData.halo = halo;
  group.position.y = group.userData.baseY;
  return group;
}

/** Ambient drift particles. */
function buildParticles(texture) {
  const COUNT = 44;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const drift = [];

  const coral = new THREE.Color(COLORS.coral);
  const offWhite = new THREE.Color(COLORS.offWhite);

  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 11;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;

    const color = Math.random() > 0.6 ? coral : offWhite;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    drift.push({
      x: (Math.random() - 0.5) * 0.06,
      y: (Math.random() - 0.5) * 0.06 + 0.02,
      z: (Math.random() - 0.5) * 0.04,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    // ~3px on a 1080p viewport at the scene's working depth.
    size: 0.035,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.userData.drift = drift;
  return points;
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Boots the WebGL scene.
 * @returns {object|null} A handle with `parts`, `lights`, `setPointer`,
 *   `setAssembled`, `reveal` and `dispose`, or null when 3D is not appropriate.
 */
export function initThreeScene() {
  const canvas = document.querySelector('.webgl');
  if (!canvas) return null;
  if (!canRender3D() || !supportsWebGL()) return null;

  const scene = new THREE.Scene();
  const sizes = { width: window.innerWidth, height: window.innerHeight };

  const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 100);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  /* --- Environment ------------------------------------------------------ */

  /*
   * A pre-filtered room environment is what separates "dark grey boxes" from a
   * luxury product render: it gives MeshPhysicalMaterial real specular
   * highlights along every edge instead of flat shading. Generated once from
   * Three's built-in room, then thrown away, so no HDR file is ever fetched.
   */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = roomTarget.texture;
  pmrem.dispose();

  /* --- Lighting -------------------------------------------------------- */

  const ambient = new THREE.AmbientLight(0xfff2ea, 0.15);

  const key = new THREE.DirectionalLight(0xffffff, 0.5);
  key.position.set(5, 8, 5);

  const coralLight = new THREE.PointLight(COLORS.coral, 0.4, 18, 2);
  coralLight.position.set(1.4, 0.6, 3);

  const rim = new THREE.DirectionalLight(COLORS.rim, 0.2);
  rim.position.set(-3, -2, -5);

  scene.add(ambient, key, coralLight, rim);

  /* --- Structure ------------------------------------------------------- */

  const baseMaterial = makeStructureMaterial();

  const structure = new THREE.Group();
  const foundation = buildFoundation();
  const pillars = buildPillars(baseMaterial);
  const riskLayer = buildRiskLayer();
  const controls = buildControlBlocks(baseMaterial);
  const connections = buildConnections(controls.userData.positions, controls.userData.baseY);
  const crown = buildCrown();

  structure.add(foundation, pillars, riskLayer, controls, connections, crown);
  structure.scale.setScalar(1.05);
  scene.add(structure);

  // Particles live outside the structure group so assembly tilts do not drag them.
  const particleTexture = createParticleTexture();
  const particles = buildParticles(particleTexture);
  scene.add(particles);

  /* --- Layout ---------------------------------------------------------- */

  const layout = () => {
    // Ramps from just clear of the copy column on a 1100px viewport to a
    // comfortable right-hand placement on a wide one.
    const t = THREE.MathUtils.clamp((sizes.width - WEBGL_BREAKPOINT) / 500, 0, 1);
    const offset = THREE.MathUtils.lerp(2.4, DESKTOP_OFFSET_X, t);
    structure.position.x = offset;
    coralLight.position.x = offset - 1.1;
    // Narrower viewports need the structure pulled back to stay fully framed.
    const fit = Math.min(1, sizes.width / 1400);
    structure.scale.setScalar(0.8 + fit * 0.25);
  };
  layout();

  /* --- Pointer --------------------------------------------------------- */

  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };

  const setPointer = (nx, ny) => {
    pointer.x = nx;
    pointer.y = ny;
  };

  /* --- Idle / assembled state ------------------------------------------ */

  const state = {
    assembled: 0, // 0 → 1 across the final "settled" scroll band
    revealed: false,
  };

  const setAssembled = (value) => {
    state.assembled = THREE.MathUtils.clamp(value, 0, 1);
  };

  /* --- Render loop ----------------------------------------------------- */

  const clock = new THREE.Clock();
  const reduced = prefersReducedMotion();
  let frameId = 0;

  /*
   * If the window is resized below the 3D breakpoint the canvas is hidden by
   * CSS, but the renderer would happily keep burning frames behind it. Track
   * the same media query and skip the draw call while it is out of view.
   */
  const wideEnough = window.matchMedia(`(min-width: ${WEBGL_BREAKPOINT}px)`);
  let onScreen = wideEnough.matches;
  wideEnough.addEventListener('change', (event) => {
    onScreen = event.matches;
  });

  const render = () => {
    // getDelta() advances the clock, so read it first and take elapsed after.
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

    if (!reduced) {
      // Slow idle rotation of the whole structure.
      structure.rotation.y += 0.001;

      // Cursor tilt, eased. Max ±5° on each axis.
      eased.x += (pointer.x - eased.x) * 0.05;
      eased.y += (pointer.y - eased.y) * 0.05;

      const maxTilt = THREE.MathUtils.degToRad(5);
      structure.rotation.x = eased.y * maxTilt;
      structure.rotation.z = -eased.x * maxTilt * 0.4;

      // Camera answers the cursor with a much gentler ±2°.
      const camTilt = THREE.MathUtils.degToRad(2);
      camera.rotation.y = -eased.x * camTilt;
      camera.rotation.x = eased.y * camTilt;

      // Foundation and crown breathe.
      foundation.position.y = foundation.userData.baseY + Math.sin(elapsed * 0.8) * 0.045;
      crown.rotation.y += 0.004;
      crown.rotation.x = Math.sin(elapsed * 0.6) * 0.12;

      // Particle drift, wrapped inside a generous bounding box.
      const positions = particles.geometry.attributes.position;
      const drift = particles.userData.drift;
      for (let i = 0; i < drift.length; i++) {
        positions.array[i * 3] += drift[i].x * delta;
        positions.array[i * 3 + 1] += drift[i].y * delta;
        positions.array[i * 3 + 2] += drift[i].z * delta;
        if (positions.array[i * 3 + 1] > 6) positions.array[i * 3 + 1] = -6;
        if (positions.array[i * 3] > 9) positions.array[i * 3] = -9;
        if (positions.array[i * 3] < -9) positions.array[i * 3] = 9;
      }
      positions.needsUpdate = true;

      // Once assembled the whole thing pulses with coral light.
      const pulse = 0.4 + state.assembled * (0.35 + Math.sin(elapsed * 1.6) * 0.28);
      // Hovering near the structure lifts the coral light further.
      const proximity = Math.max(0, 1 - Math.hypot(pointer.x - 0.45, pointer.y) * 1.4);
      coralLight.intensity = pulse + proximity * 0.35;

      crown.userData.halo.material.opacity =
        0.1 + state.assembled * (0.12 + Math.sin(elapsed * 1.6) * 0.08);
    }

    if (onScreen) renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(render);
  };

  render();

  /* --- Resize ---------------------------------------------------------- */

  const resize = () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    layout();
  };

  /* --- Teardown -------------------------------------------------------- */

  const dispose = () => {
    window.cancelAnimationFrame(frameId);
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose?.());
    });
    particleTexture.dispose();
    roomTarget.dispose();
    renderer.dispose();
  };

  return {
    canvas,
    scene,
    camera,
    renderer,
    structure,
    parts: { foundation, pillars, riskLayer, controls, connections, crown, particles },
    lights: { ambient, key, coralLight, rim },
    setPointer,
    setAssembled,
    resize,
    dispose,
    /** Fades the canvas in once the loader has cleared. */
    reveal() {
      if (state.revealed) return;
      state.revealed = true;
      canvas.style.opacity = '1';
      canvas.style.transition = 'opacity 0.9s ease';
    },
  };
}
