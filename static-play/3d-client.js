/**
 * WorldMind 3D district client v1 - Three.js, Play API only (no duplicated simulation).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('wm-3d-canvas');
const banner = document.getElementById('wm-3d-banner');
const selectionTitle = document.getElementById('wm-3d-selection-title');
const selectionDesc = document.getElementById('wm-3d-selection-desc');
const actionsEl = document.getElementById('wm-3d-actions');
const outputEl = document.getElementById('wm-3d-output');
const commandInput = document.getElementById('wm-3d-command');
const form = document.getElementById('wm-3d-form');
const dayEl = document.getElementById('wm-3d-day');
const moneyEl = document.getElementById('wm-3d-money');
const locEl = document.getElementById('wm-3d-loc');
const hintEl = document.getElementById('wm-3d-hint');
const questTitleEl = document.getElementById('wm-3d-quest-title');
const questStepsEl = document.getElementById('wm-3d-quest-steps');

const LOCOMOTION = Object.freeze({
  walkSpeed: 5.8,
  sprintSpeed: 10.5,
  acceleration: 38,
  deceleration: 46,
  districtMin: -16,
  districtMax: 16,
  playerRadius: 0.42,
  enterRadius: 2.7,
  hotspotRadius: 1.4,
  agentRadius: 1.8,
  maxDeltaSec: 1 / 20
});

const keyState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false
};

let liveMode = false;
let visualCues = null;
let gameShell = null;
let playerSnapshot = null;
const pickables = new Map();
/** Agent meshes with idle bob/turn animation (base pose in userData.idleBase). */
const idleAgentMeshes = [];

/** Active walk animation from POST /api/command move result. */
let walkAnimation = null;
let pendingVisualCues = null;
let walkStartMs = null;
let walkPlayerGroup = null;
let staticPlayerGroup = null;
let localPlayerPosition = new THREE.Vector3();
let localVelocity = new THREE.Vector3();
let localFacing = 0;
let activeProximityMeta = null;
let audioUnlocked = false;
let lastFrameMs = performance.now();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const worldGroup = new THREE.Group();
scene.add(worldGroup);

function showBanner(text, ms = 2800) {
  banner.textContent = text;
  banner.classList.remove('hidden');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => banner.classList.add('hidden'), ms);
}

function api(method, path, body) {
  return fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  }).then(async (res) => ({ status: res.status, body: await res.json() }));
}

function setHud() {
  dayEl.textContent = `Day ${gameShell?.topbar?.day ?? '-'}`;
  moneyEl.textContent = `Credits ${playerSnapshot?.money ?? gameShell?.topbar?.money ?? 0}`;
  locEl.textContent = `@ ${gameShell?.location?.name ?? gameShell?.location?.id ?? '-'}`;
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function renderQuestHud() {
  const quest = gameShell?.questProgress;
  if (!questTitleEl || !questStepsEl) return;
  if (!quest) {
    questTitleEl.textContent = 'No active case.';
    questStepsEl.innerHTML = '';
    return;
  }

  questTitleEl.textContent = quest.resolvedPathId
    ? `${quest.title || 'Case'} resolved: ${quest.resolvedPathId}`
    : `${quest.title || 'The Missing Delivery'} - ${quest.incidentStatus || 'active'}`;

  const rows = [];
  for (const path of quest.paths || []) {
    const steps = path.steps || [];
    const next = steps.find((step) => !step.done);
    const done = steps.length > 0 && steps.every((step) => step.done);
    rows.push({
      label: path.label || path.id,
      step: next?.step || (done ? 'complete' : 'waiting'),
      command: next?.step || null,
      done,
      progress: Math.max(0, Math.min(100, Math.round(path.progress ?? 0)))
    });
  }

  questStepsEl.innerHTML = rows.map((row) => `
    <li class="${row.done ? 'done' : ''}">
      <span>${row.done ? 'OK' : `${row.progress}%`}</span>
      <span><strong>${escapeText(row.label)}</strong><br>${escapeText(row.step)}</span>
      ${row.command && !row.done ? `<button type="button" data-quest-command="${escapeText(row.command)}">Run</button>` : '<span></span>'}
    </li>
  `).join('');

  questStepsEl.querySelectorAll('[data-quest-command]').forEach((button) => {
    button.addEventListener('click', () => runCommand(button.getAttribute('data-quest-command')));
  });
}

function clearWorldMeshes() {
  pickables.clear();
  idleAgentMeshes.length = 0;
  staticPlayerGroup = null;
  walkPlayerGroup = null;
  while (worldGroup.children.length) {
    const child = worldGroup.children.pop();
    child.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    worldGroup.remove(child);
  }
}

function addPickable(mesh, meta) {
  mesh.userData.pickMeta = meta;
  pickables.set(mesh.uuid, meta);
  mesh.traverse((child) => {
    if (child.isMesh) child.userData.pickMeta = meta;
  });
  worldGroup.add(mesh);
  return mesh;
}

function playerLocationId() {
  return visualCues?.playerLocationId ?? visualCues?.player?.locationId ?? gameShell?.location?.id ?? null;
}

function collidesWithDistrictBuilding(x, z) {
  const current = playerLocationId();
  for (const loc of visualCues?.locations || []) {
    if (loc.id === current) continue;
    const col = loc.collision;
    if (!col) continue;
    const [lx, , lz] = loc.position || [0, 0, 0];
    const dx = Math.abs(x - lx);
    const dz = Math.abs(z - lz);
    const radius = LOCOMOTION.playerRadius;
    if (col.shape === 'circle') {
      if (Math.hypot(x - lx, z - lz) < (col.radius ?? 1.5) + radius) return true;
      continue;
    }
    const half = col.halfExtents || [1.5, 1.5];
    if (dx < half[0] + radius && dz < half[1] + radius) return true;
  }
  return false;
}

function clampLocalPosition(x, z) {
  const nx = Math.max(LOCOMOTION.districtMin, Math.min(LOCOMOTION.districtMax, x));
  const nz = Math.max(LOCOMOTION.districtMin, Math.min(LOCOMOTION.districtMax, z));
  if (!collidesWithDistrictBuilding(nx, nz)) return [nx, nz];
  const oldX = localPlayerPosition.x;
  const oldZ = localPlayerPosition.z;
  if (!collidesWithDistrictBuilding(nx, oldZ)) return [nx, oldZ];
  if (!collidesWithDistrictBuilding(oldX, nz)) return [oldX, nz];
  return [oldX, oldZ];
}

function cameraForwardYaw() {
  return Math.atan2(
    camera.position.x - localPlayerPosition.x,
    camera.position.z - localPlayerPosition.z
  );
}

function inputDirection() {
  let moveX = 0;
  let moveZ = 0;
  if (keyState.forward) moveZ -= 1;
  if (keyState.back) moveZ += 1;
  if (keyState.left) moveX -= 1;
  if (keyState.right) moveX += 1;
  const len = Math.hypot(moveX, moveZ);
  if (len === 0) return null;
  moveX /= len;
  moveZ /= len;
  const yaw = cameraForwardYaw();
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: moveX * cos - moveZ * sin,
    z: moveX * sin + moveZ * cos
  };
}

function isTypingTarget(target) {
  return target instanceof HTMLElement
    && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

function nearestProximityMeta() {
  if (!visualCues || !staticPlayerGroup) return null;
  const pos = localPlayerPosition;
  let best = null;
  const consider = (meta, position, radius) => {
    const d = Math.hypot(pos.x - position[0], pos.z - position[2]);
    if (d <= radius && (!best || d < best.distance)) best = { ...meta, distance: d };
  };
  for (const loc of visualCues.locations || []) {
    if (loc.id === playerLocationId()) continue;
    consider({
      kind: 'location',
      id: loc.id,
      label: loc.label,
      command: loc.command,
      description: `${loc.zone} - press E to enter`
    }, loc.position, LOCOMOTION.enterRadius);
  }
  for (const hotspot of visualCues.hotspots || []) {
    consider({
      kind: 'hotspot',
      id: hotspot.id,
      label: hotspot.label,
      command: hotspot.command,
      description: hotspot.preview ?? hotspot.description ?? `Risk ${hotspot.risk ?? 1}`,
      risk: hotspot.risk
    }, hotspot.position, LOCOMOTION.hotspotRadius);
  }
  for (const loc of visualCues.locations || []) {
    for (const agent of loc.agents || []) {
      consider({
        kind: 'agent',
        id: agent.id,
        label: agent.name,
        commands: agent.commands,
        description: agent.role || 'district agent'
      }, agent.position, LOCOMOTION.agentRadius);
    }
  }
  return best;
}

function updateProximityHint() {
  activeProximityMeta = nearestProximityMeta();
  if (!hintEl) return;
  if (!activeProximityMeta || walkAnimation) {
    hintEl.textContent = '';
    hintEl.classList.remove('visible');
    return;
  }
  hintEl.textContent = `E - ${activeProximityMeta.kind === 'agent' ? 'Talk to' : 'Use'} ${activeProximityMeta.label}`;
  hintEl.classList.add('visible');
}

function updateLocalLocomotion(dt) {
  if (walkAnimation || !staticPlayerGroup || !visualCues) return;
  const step = Math.min(dt, LOCOMOTION.maxDeltaSec);
  const dir = inputDirection();
  const maxSpeed = keyState.sprint ? LOCOMOTION.sprintSpeed : LOCOMOTION.walkSpeed;
  const previous = localPlayerPosition.clone();

  if (dir) {
    const targetX = dir.x * maxSpeed;
    const targetZ = dir.z * maxSpeed;
    const accel = LOCOMOTION.acceleration * step;
    localVelocity.x += Math.max(-accel, Math.min(accel, targetX - localVelocity.x));
    localVelocity.z += Math.max(-accel, Math.min(accel, targetZ - localVelocity.z));
    localFacing = Math.atan2(dir.x, dir.z);
  } else {
    const damp = Math.exp(-LOCOMOTION.deceleration * step);
    localVelocity.multiplyScalar(damp);
    if (Math.hypot(localVelocity.x, localVelocity.z) < 0.04) localVelocity.set(0, 0, 0);
  }

  const [nx, nz] = clampLocalPosition(
    localPlayerPosition.x + localVelocity.x * step,
    localPlayerPosition.z + localVelocity.z * step
  );
  localPlayerPosition.set(nx, LOCOMOTION.playerRadius * 0.25, nz);
  staticPlayerGroup.position.copy(localPlayerPosition);
  staticPlayerGroup.rotation.y = localFacing;

  const delta = localPlayerPosition.clone().sub(previous);
  if (delta.lengthSq() > 0) {
    camera.position.add(delta);
    controls.target.add(delta);
  }
}

function buildGround(env) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 48),
    new THREE.MeshStandardMaterial({ color: env?.groundColor ?? '#0d1117', roughness: 0.92 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  worldGroup.add(ground);

  const grid = new THREE.GridHelper(48, 48, env?.gridColor ?? '#1f2937', env?.gridColor ?? '#111827');
  grid.position.y = 0.02;
  worldGroup.add(grid);
}

function buildEdges(edges) {
  const mat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35 });
  for (const edge of edges || []) {
    if (!edge.fromPosition || !edge.toPosition) continue;
    const points = [
      new THREE.Vector3(...edge.fromPosition),
      new THREE.Vector3(...edge.toPosition)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, mat);
    line.position.y = 0.15;
    worldGroup.add(line);
  }
}

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
const gltfLoader = new GLTFLoader();
const gltfCache = new Map();

function shouldUseGltfBuilding(modelUrl) {
  return Boolean(modelUrl);
}

function shouldUseGltfBody(renderMode = 'mesh3d', modelUrl) {
  return renderMode === 'mesh3d' && Boolean(modelUrl);
}

function resolveAssetUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url;
  return `/${url.replace(/^\//, '')}`;
}

function loadGltfScene(url) {
  const resolved = resolveAssetUrl(url);
  if (!resolved) return Promise.reject(new Error('no model url'));
  if (gltfCache.has(resolved)) return gltfCache.get(resolved);
  const promise = new Promise((resolve, reject) => {
    gltfLoader.load(
      resolved,
      (gltf) => {
        const root = gltf.scene.clone(true);
        root.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        resolve(root);
      },
      undefined,
      reject
    );
  });
  gltfCache.set(resolved, promise);
  return promise;
}

function mountGltfModel(parent, url, onFail) {
  const slot = new THREE.Group();
  parent.add(slot);
  loadGltfScene(url)
    .then((scene) => {
      slot.clear();
      slot.add(scene);
    })
    .catch(() => {
      if (typeof onFail === 'function') onFail(slot);
    });
  return slot;
}

function buildCapsuleBody(parent, color = '#58a6ff', emissive = '#1d4ed8') {
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.25 })
  );
  body.position.y = 0.9;
  body.castShadow = true;
  parent.add(body);
  return body;
}

function buildProceduralBuildingMesh(loc) {
  const [w, h, d] = loc.scale || [2, 2.5, 2];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: loc.color || '#64748b',
      emissive: new THREE.Color(loc.emissive || '#000000'),
      emissiveIntensity: loc.emissiveIntensity ?? 0.1
    })
  );
  mesh.position.y = h / 2;
  mesh.castShadow = true;
  return mesh;
}

function alternateSceneTexturePath(path) {
  if (!path) return null;
  if (path.endsWith('.png')) return path.replace(/\.png$/, '.webp');
  if (path.endsWith('.webp')) return path.replace(/\.webp$/, '.png');
  return null;
}

function loadSceneTexture(path, triedAlt = false) {
  if (!path) return null;
  if (textureCache.has(path)) return textureCache.get(path);
  const tex = textureLoader.load(
    path,
    (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
    },
    undefined,
    () => {
      if (triedAlt) return;
      const alt = alternateSceneTexturePath(path);
      if (!alt) return;
      const fallback = loadSceneTexture(alt, true);
      if (fallback) textureCache.set(path, fallback);
    }
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(path, tex);
  return tex;
}

function buildLocations(locations) {
  const BILLBOARD_W = 4.2;
  const BILLBOARD_H = 2.8;
  for (const loc of locations || []) {
    const [px, , pz] = loc.position;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.3, 32),
      new THREE.MeshStandardMaterial({
        color: loc.isPlayerHere ? '#f59e0b' : '#1f2937',
        emissive: new THREE.Color(loc.isPlayerHere ? '#f59e0b' : '#000000'),
        emissiveIntensity: loc.isPlayerHere ? 0.35 : 0
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(px, 0.02, pz);
    worldGroup.add(ring);

    const buildingGroup = new THREE.Group();
    buildingGroup.position.set(px, 0, pz);
    let mesh;

    if (shouldUseGltfBuilding(loc.modelUrl)) {
      mountGltfModel(buildingGroup, loc.modelUrl, (slot) => {
        const fallback = buildProceduralBuildingMesh(loc);
        slot.add(fallback);
      });
      mesh = buildingGroup;
    } else {
      const tex = loadSceneTexture(loc.sceneTexture);
      if (tex) {
        mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(BILLBOARD_W, BILLBOARD_H),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
        );
        mesh.position.set(0, BILLBOARD_H / 2 + 0.15, 0);
      } else {
        mesh = buildProceduralBuildingMesh(loc);
        mesh.position.set(0, mesh.position.y, 0);
      }
      buildingGroup.add(mesh);
      mesh = buildingGroup;
    }

    addPickable(mesh, {
      kind: 'location',
      id: loc.id,
      label: loc.label,
      command: loc.command,
      description: `${loc.zone} | ${loc.isPlayerHere ? 'you are here' : 'click to travel'}`
    });

    const labelHeight = shouldUseGltfBuilding(loc.modelUrl)
      ? (loc.footprint?.[1] ?? BILLBOARD_H) + 0.8
      : BILLBOARD_H + 0.8;
    const label = makeLabel(loc.label + (loc.isPlayerHere ? ' *' : ''));
    label.position.set(px, labelHeight, pz);
    worldGroup.add(label);

    for (const agent of loc.agents || []) {
      const agentGroup = new THREE.Group();
      agentGroup.position.set(agent.position[0], agent.position[1], agent.position[2]);

      if (shouldUseGltfBody(agent.renderMode, agent.modelUrl)) {
        mountGltfModel(agentGroup, agent.modelUrl, (slot) => {
          buildCapsuleBody(slot);
        });
      } else {
        buildCapsuleBody(agentGroup);
      }

      agentGroup.castShadow = true;
      const idleKind = agent.idleAnimation === 'turn' ? 'turn' : 'bob';
      agentGroup.userData.idleBase = {
        y: agent.position[1],
        phase: (agent.id || '').split('').reduce((n, c) => n + c.charCodeAt(0), 0) * 0.17,
        kind: idleKind
      };
      idleAgentMeshes.push(agentGroup);
      addPickable(agentGroup, {
        kind: 'agent',
        id: agent.id,
        label: agent.name,
        commands: agent.commands,
        description: agent.role || 'district agent'
      });
    }
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function sampleAlongPath(points, easedT) {
  if (!points.length) return { position: new THREE.Vector3(), index: 0 };
  if (points.length === 1) return { position: points[0].clone(), index: 0 };

  const segmentLengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = points[i].distanceTo(points[i + 1]);
    segmentLengths.push(len);
    total += len;
  }
  if (total <= 0) return { position: points[points.length - 1].clone(), index: points.length - 1 };

  let remaining = easedT * total;
  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (remaining <= segLen || i === segmentLengths.length - 1) {
      const segT = segLen > 0 ? remaining / segLen : 0;
      return {
        position: new THREE.Vector3().lerpVectors(points[i], points[i + 1], segT),
        index: i
      };
    }
    remaining -= segLen;
  }
  return { position: points[points.length - 1].clone(), index: points.length - 1 };
}

function buildWalkPlayerMesh() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.65, 32),
    new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);
  const player = visualCues?.player;
  if (shouldUseGltfBody(player?.renderMode, player?.modelUrl)) {
    mountGltfModel(group, player.modelUrl, (slot) => {
      buildCapsuleBody(slot, '#fbbf24', '#f59e0b');
    });
  } else {
    buildCapsuleBody(group, '#fbbf24', '#f59e0b');
  }
  return group;
}

function startWalkAnimation(animation, nextCues) {
  walkAnimation = animation;
  pendingVisualCues = nextCues;
  walkStartMs = performance.now();
  controls.enabled = false;

  if (walkPlayerGroup) {
    worldGroup.remove(walkPlayerGroup);
  }
  walkPlayerGroup = buildWalkPlayerMesh();
  if (staticPlayerGroup) staticPlayerGroup.visible = false;
  const start = animation.waypoints[0] || [0, 0.1, 0];
  walkPlayerGroup.position.set(start[0], start[1] ?? 0.1, start[2]);
  worldGroup.add(walkPlayerGroup);
}

function finishWalkAnimation() {
  walkAnimation = null;
  walkStartMs = null;
  controls.enabled = true;
  if (walkPlayerGroup) {
    worldGroup.remove(walkPlayerGroup);
    walkPlayerGroup = null;
  }
  if (pendingVisualCues) {
    applyVisualCues(pendingVisualCues);
    pendingVisualCues = null;
  }
}

function tickWalkAnimation(now) {
  if (!walkAnimation || walkStartMs === null) return;

  const rawT = Math.min(1, (now - walkStartMs) / walkAnimation.durationMs);
  const easedT = easeInOutCubic(rawT);

  const pathPoints = walkAnimation.waypoints.map(([x, y, z]) => new THREE.Vector3(x, y ?? 0.1, z));
  let cameraPoints;
  if (walkAnimation.cameraWaypoints?.length) {
    cameraPoints = walkAnimation.cameraWaypoints.map(([x, y, z]) =>
      new THREE.Vector3(x, y ?? 1.65, z)
    );
  } else {
    cameraPoints = pathPoints.map((point, index) => {
      const prev = pathPoints[Math.max(index - 1, 0)];
      const dx = point.x - prev.x;
      const dz = point.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      return new THREE.Vector3(point.x - (dx / len) * 4.5, 1.65, point.z - (dz / len) * 4.5);
    });
  }
  const lookAt = walkAnimation.lookAt || walkAnimation.camera?.target || [0, 1.4, 0];

  const { position } = sampleAlongPath(pathPoints, easedT);
  const { position: camPos } = sampleAlongPath(cameraPoints, easedT);

  if (walkPlayerGroup) walkPlayerGroup.position.copy(position);

  const lookY = THREE.MathUtils.lerp(1.4, lookAt[1], easedT);
  camera.position.copy(camPos);
  controls.target.set(position.x, lookY, position.z);
  camera.lookAt(position.x, lookY, position.z);

  if (rawT >= 1) finishWalkAnimation();
}

function buildPlayer(player) {
  if (!player?.position) return;
  const [x, y, z] = player.position;
  staticPlayerGroup = new THREE.Group();
  staticPlayerGroup.position.set(x, y, z);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.65, 32),
    new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  staticPlayerGroup.add(ring);
  if (shouldUseGltfBody(player.renderMode, player.modelUrl)) {
    mountGltfModel(staticPlayerGroup, player.modelUrl, (slot) => {
      buildCapsuleBody(slot, '#fbbf24', '#f59e0b');
    });
  } else {
    buildCapsuleBody(staticPlayerGroup, '#fbbf24', '#f59e0b');
  }
  localPlayerPosition.set(x, y, z);
  localVelocity.set(0, 0, 0);
  localFacing = 0;
  worldGroup.add(staticPlayerGroup);
}

function buildHotspots(hotspots) {
  for (const hs of hotspots || []) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#b45309', emissiveIntensity: 0.6 })
    );
    mesh.position.set(hs.position[0], hs.position[1], hs.position[2]);
    addPickable(mesh, {
      kind: 'hotspot',
      id: hs.id,
      label: hs.label,
      command: hs.command,
      description: `Risk ${hs.risk ?? 1}`
    });
  }
}

function makeLabel(text) {
  const canvas2d = document.createElement('canvas');
  const ctx = canvas2d.getContext('2d');
  canvas2d.width = 256;
  canvas2d.height = 64;
  ctx.fillStyle = 'rgba(13,17,23,0.75)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#e6edf3';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(canvas2d);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}

function applyVisualCues(cues) {
  clearWorldMeshes();
  visualCues = cues;
  const env = cues.environment || {};
  scene.background = new THREE.Color(env.fogColor ?? '#0a0e14');
  scene.fog = new THREE.Fog(env.fogColor ?? '#0a0e14', env.fogNear ?? 18, env.fogFar ?? 42);

  const amb = new THREE.AmbientLight(0xffffff, env.ambientIntensity ?? 0.55);
  const sun = new THREE.DirectionalLight(0xfff7ed, env.sunIntensity ?? 1.1);
  sun.position.set(12, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  worldGroup.add(amb, sun);

  buildGround(env);
  buildEdges(cues.edges);
  buildLocations(cues.locations);
  buildHotspots(cues.hotspots);
  buildPlayer(cues.player);

  const cam = cues.camera || {};
  const target = new THREE.Vector3(...(cam.walkTarget || cam.target || [0, 1.4, 0]));
  const eye = cam.walkEye || [target.x, 1.65, target.z + 4.5];
  controls.target.copy(target);
  camera.position.set(eye[0], eye[1], eye[2]);
  controls.update();
}

function renderActions(meta) {
  actionsEl.innerHTML = '';
  if (!meta) return;

  const addBtn = (label, cmd) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => runCommand(cmd));
    actionsEl.appendChild(btn);
  };

  if (meta.kind === 'location') addBtn(`Move to ${meta.label}`, meta.command);
  if (meta.kind === 'hotspot') addBtn(meta.label, meta.command);
  if (meta.kind === 'agent' && meta.commands) {
    addBtn('Talk', meta.commands.talk);
    addBtn('Ask', meta.commands.ask);
    addBtn('Pay 5', meta.commands.pay);
    addBtn('Leno', meta.commands.leno);
  }
}

function selectMeta(meta) {
  selectionTitle.textContent = meta?.label || 'Selection';
  selectionDesc.textContent = meta?.description || 'Choose an action';
  renderActions(meta);
}

async function refreshState() {
  const res = await api('GET', '/api/state');
  if (res.status !== 200 || !res.body.ok) throw new Error('state fetch failed');
  gameShell = res.body.gameShell;
  playerSnapshot = res.body.playerSnapshot;
  if (res.body.visualCues) applyVisualCues(res.body.visualCues);
  setHud();
  renderQuestHud();
}

function findMajorDecision(commandText) {
  const normalized = String(commandText || '').trim().toLowerCase();
  if (!normalized) return null;
  return (gameShell?.majorDecisions || []).find((decision) => {
    const command = String(decision.command || '').trim().toLowerCase();
    return command && (normalized === command || normalized.startsWith(`${command} `));
  }) ?? null;
}

async function maybeBranchBefore(commandText) {
  if (!liveMode) return;
  const decision = findMajorDecision(commandText);
  if (!decision?.branchSuggested) return;
  const shouldBranch = window.confirm(`Major decision: ${decision.label || decision.id}\n\nCreate a save branch before continuing?`);
  if (!shouldBranch) return;
  const save = await api('POST', '/api/save', { note: `Before: ${commandText}` });
  const snapshotId = save.body?.snapshotId;
  if (!snapshotId) return;
  await api('POST', '/api/branch', {
    name: `before-${decision.id || 'decision'}`,
    snapshotId,
    note: decision.label || commandText
  });
  showBanner(`Branch saved: before-${decision.id || 'decision'}`);
}

function unlockAudio() {
  audioUnlocked = true;
}

function playAudioCues(cues = []) {
  if (!audioUnlocked || !Array.isArray(cues)) return;
  for (const cue of cues) {
    const src = resolveAssetUrl(cue.path);
    if (!src) continue;
    const audio = new Audio(src);
    audio.volume = cue.kind === 'walk_start' ? 0.28 : 0.42;
    audio.play().catch(() => {});
  }
}

async function runCommand(text) {
  const cmd = String(text || '').trim();
  if (!cmd) return;
  unlockAudio();
  if (!liveMode) {
    outputEl.textContent = `Offline - start play-server. Would run: ${cmd}`;
    return;
  }
  outputEl.textContent = 'Running...';
  await maybeBranchBefore(cmd);
  const res = await api('POST', '/api/command', { text: cmd });
  if (res.status !== 200 || !res.body.ok) {
    outputEl.textContent = res.body.error || 'Command failed';
    return;
  }
  const result = res.body.result || {};
  if (result.gameShell) gameShell = result.gameShell;
  if (result.playerSnapshot) playerSnapshot = result.playerSnapshot;
  setHud();
  renderQuestHud();
  playAudioCues(result.audioCues);

  const lines = [result.text || res.body.text || 'Done'];
  if (result.consequenceBeat?.summary) lines.push(result.consequenceBeat.summary);
  if (result.dialogue?.message) lines.push(result.dialogue.message);
  if (result.leno?.summary) lines.push(`Leno: ${result.leno.summary}`);
  if (result.majorDecisionPrompt?.label) lines.push(`Major decision: ${result.majorDecisionPrompt.label}`);
  outputEl.textContent = lines.join('\n\n');
  commandInput.value = '';
  showBanner(`OK ${cmd}`);

  if (result.walkAnimation?.waypoints?.length) {
    const stateRes = await api('GET', '/api/state');
    if (stateRes.body.visualCues) startWalkAnimation(result.walkAnimation, stateRes.body.visualCues);
    return;
  }

  if (result.gameShell && visualCues) {
    const stateRes = await api('GET', '/api/state');
    if (stateRes.body.visualCues) applyVisualCues(stateRes.body.visualCues);
  }
}

function onPointerDown(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const meshes = [...pickables.keys()].map((uuid) => worldGroup.children.find((c) => c.uuid === uuid)).filter(Boolean);
  const allMeshes = [];
  worldGroup.traverse((obj) => {
    if (obj.isMesh && obj.userData.pickMeta) allMeshes.push(obj);
  });
  const hits = raycaster.intersectObjects(allMeshes, false);
  if (hits.length) selectMeta(hits[0].object.userData.pickMeta);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  void runCommand(commandInput.value);
});

function setMovementKey(code, value) {
  if (code === 'KeyW' || code === 'ArrowUp') keyState.forward = value;
  else if (code === 'KeyS' || code === 'ArrowDown') keyState.back = value;
  else if (code === 'KeyA' || code === 'ArrowLeft') keyState.left = value;
  else if (code === 'KeyD' || code === 'ArrowRight') keyState.right = value;
  else if (code === 'ShiftLeft' || code === 'ShiftRight') keyState.sprint = value;
  else return false;
  return true;
}

function runPrimaryProximityAction() {
  if (!activeProximityMeta || walkAnimation) return;
  selectMeta(activeProximityMeta);
  if (activeProximityMeta.kind === 'agent') {
    void runCommand(activeProximityMeta.commands?.talk);
  } else {
    void runCommand(activeProximityMeta.command);
  }
}

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) return;
  if (event.code === 'KeyE' || event.code === 'Enter') {
    event.preventDefault();
    if (!event.repeat) runPrimaryProximityAction();
    return;
  }
  if (setMovementKey(event.code, true)) {
    event.preventDefault();
    unlockAudio();
  }
});

window.addEventListener('keyup', (event) => {
  if (setMovementKey(event.code, false)) event.preventDefault();
});

window.addEventListener('blur', () => {
  Object.keys(keyState).forEach((key) => { keyState[key] = false; });
  localVelocity.set(0, 0, 0);
});

canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function tickIdleAgentAnimations(now) {
  const t = (now ?? performance.now()) * 0.001;
  for (const mesh of idleAgentMeshes) {
    const base = mesh.userData.idleBase;
    if (!base) continue;
    if (base.kind === 'bob' || base.kind === 'turn') {
      mesh.position.y = base.y + Math.sin(t * 1.6 + base.phase) * 0.07;
    }
    if (base.kind === 'turn') {
      mesh.rotation.y = Math.sin(t * 0.45 + base.phase) * 0.4;
    } else {
      mesh.rotation.y = 0;
    }
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const frameNow = now ?? performance.now();
  const dt = Math.max(0, (frameNow - lastFrameMs) / 1000);
  lastFrameMs = frameNow;
  if (walkAnimation) tickWalkAnimation(frameNow);
  else {
    updateLocalLocomotion(dt);
    controls.update();
  }
  updateProximityHint();
  tickIdleAgentAnimations(frameNow);
  renderer.render(scene, camera);
}

async function boot() {
  try {
    const health = await api('GET', '/api/health');
    if (health.status === 200 && health.body.ok) {
      liveMode = true;
      showBanner(`Live | API ${health.body.apiVersion || '1.0.0'}`, 4000);
      await refreshState();
    } else {
      throw new Error('no api');
    }
  } catch {
    liveMode = false;
    showBanner('Start: npm run play:server - then open /3d.html', 8000);
    applyVisualCues({
      kind: 'worldmind_3d_visual_cues',
      version: 1,
      environment: {},
      camera: { target: [0, 1.5, 0] },
      locations: [
        { id: 'cafe', label: 'Cafe', zone: 'social', position: [-2, 0, 0], scale: [2.5, 3, 2.5], color: '#c97b3d', command: 'move cafe', agents: [] },
        { id: 'market', label: 'Market', zone: 'commerce', position: [4, 0, -2], scale: [2.5, 2.8, 2.5], color: '#14b8a6', command: 'move market', agents: [] },
        { id: 'workshop', label: 'Workshop', zone: 'industrial', position: [3, 0, 4], scale: [2.5, 2.6, 2.5], color: '#6b7280', command: 'move workshop', agents: [] },
        { id: 'apartment', label: 'Apartment', zone: 'residential', position: [-5, 0, -4], scale: [2.2, 2.2, 2.2], color: '#4a6fa5', command: 'move apartment', agents: [] }
      ],
      hotspots: [],
      edges: []
    });
  }
  animate();
}

void boot();
