/**
 * WorldMind 3D district client v1 — Three.js, Play API only (no duplicated simulation).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

let liveMode = false;
let visualCues = null;
let gameShell = null;
let playerSnapshot = null;
const pickables = new Map();

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
  dayEl.textContent = `Day ${gameShell?.topbar?.day ?? '—'}`;
  moneyEl.textContent = `¢ ${playerSnapshot?.money ?? gameShell?.topbar?.money ?? 0}`;
  locEl.textContent = `@ ${gameShell?.location?.name ?? gameShell?.location?.id ?? '—'}`;
}

function clearWorldMeshes() {
  pickables.clear();
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
  worldGroup.add(mesh);
  return mesh;
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

function loadSceneTexture(path) {
  if (!path) return null;
  if (textureCache.has(path)) return textureCache.get(path);
  const tex = textureLoader.load(path);
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

    const tex = loadSceneTexture(loc.sceneTexture);
    let mesh;
    if (tex) {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(BILLBOARD_W, BILLBOARD_H),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
      );
      mesh.position.set(px, BILLBOARD_H / 2 + 0.15, pz);
    } else {
      const [w, h, d] = loc.scale || [2, 2.5, 2];
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: loc.color || '#64748b',
          emissive: new THREE.Color(loc.emissive || '#000000'),
          emissiveIntensity: loc.emissiveIntensity ?? 0.1
        })
      );
      mesh.position.set(px, h / 2, pz);
    }
    mesh.castShadow = true;
    addPickable(mesh, {
      kind: 'location',
      id: loc.id,
      label: loc.label,
      command: loc.command,
      description: `${loc.zone} · ${loc.isPlayerHere ? 'you are here' : 'click to travel'}`
    });

    const label = makeLabel(loc.label + (loc.isPlayerHere ? ' ★' : ''));
    label.position.set(px, BILLBOARD_H + 0.8, pz);
    worldGroup.add(label);

    for (const agent of loc.agents || []) {
      const agentMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
        new THREE.MeshStandardMaterial({ color: '#58a6ff', emissive: '#1d4ed8', emissiveIntensity: 0.25 })
      );
      agentMesh.position.set(agent.position[0], agent.position[1], agent.position[2]);
      agentMesh.castShadow = true;
      addPickable(agentMesh, {
        kind: 'agent',
        id: agent.id,
        label: agent.name,
        commands: agent.commands,
        description: agent.role || 'district agent'
      });
    }
  }
}

function buildPlayer(player) {
  if (!player?.position) return;
  const [x, y, z] = player.position;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.65, 32),
    new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, y + 0.05, z);
  worldGroup.add(ring);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.5, 4, 8),
    new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#f59e0b', emissiveIntensity: 0.5 })
  );
  body.position.set(x, 0.9, z);
  worldGroup.add(body);
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
}

async function runCommand(text) {
  const cmd = String(text || '').trim();
  if (!cmd) return;
  if (!liveMode) {
    outputEl.textContent = `Offline — start play-server. Would run: ${cmd}`;
    return;
  }
  outputEl.textContent = 'Running…';
  const res = await api('POST', '/api/command', { text: cmd });
  if (res.status !== 200 || !res.body.ok) {
    outputEl.textContent = res.body.error || 'Command failed';
    return;
  }
  const result = res.body.result || {};
  if (result.gameShell) gameShell = result.gameShell;
  if (result.playerSnapshot) playerSnapshot = result.playerSnapshot;
  if (result.gameShell && visualCues) {
    const stateRes = await api('GET', '/api/state');
    if (stateRes.body.visualCues) applyVisualCues(stateRes.body.visualCues);
  }
  setHud();
  const lines = [result.text || res.body.text || 'Done'];
  if (result.consequenceBeat?.summary) lines.push(result.consequenceBeat.summary);
  outputEl.textContent = lines.join('\n\n');
  commandInput.value = '';
  showBanner(`✓ ${cmd}`);
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

canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

async function boot() {
  try {
    const health = await api('GET', '/api/health');
    if (health.status === 200 && health.body.ok) {
      liveMode = true;
      showBanner(`Live · API ${health.body.apiVersion || '1.0.0'}`, 4000);
      await refreshState();
    } else {
      throw new Error('no api');
    }
  } catch {
    liveMode = false;
    showBanner('Start: npm run play:server — then open /3d.html', 8000);
    applyVisualCues({
      kind: 'worldmind_3d_visual_cues',
      version: 1,
      environment: {},
      camera: { target: [0, 1.5, 0] },
      locations: [
        { id: 'cafe', label: 'Café', zone: 'social', position: [-2, 0, 0], scale: [2.5, 3, 2.5], color: '#c97b3d', command: 'move cafe', agents: [] },
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
