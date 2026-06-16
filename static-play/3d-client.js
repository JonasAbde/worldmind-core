import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const LOCATION_LAYOUT = {
  apartment: { x: -10, z: -8, color: 0x38475d },
  cafe: { x: -2, z: 6, color: 0x5b3f2f },
  workshop: { x: 9, z: 4, color: 0x44513a },
  market: { x: 6, z: -8, color: 0x4b3d55 }
};

const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const actionsEl = document.getElementById("actions");
const logEl = document.getElementById("log");
const modeEl = document.getElementById("mode");
const canvas = document.getElementById("viewport");

let gameState = null;
let selectedAgentId = null;
let selectedLocationId = null;
let offlineMode = false;

function setStatus(text, klass = "") {
  statusEl.className = `status ${klass}`.trim();
  statusEl.textContent = text;
}

function appendLog(line) {
  const ts = new Date().toLocaleTimeString();
  logEl.innerHTML = `<div>[${ts}] ${line}</div>` + logEl.innerHTML;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function loadState() {
  try {
    const apiState = await fetchJson("/api/state");
    const seeded = await fetchJson("./state.json");
    // api/state on current server returns summary sections; world in static state gives complete map.
    // Keep static world as baseline and hydrate top-level values from live API when available.
    seeded.world.day = apiState.day ?? seeded.world.day;
    seeded.world.time = apiState.time ?? seeded.world.time;
    seeded.world.tick = apiState.tick ?? seeded.world.tick;
    gameState = seeded.world;
    offlineMode = false;
    modeEl.innerHTML = "<span class='ok'>Live mode: command calls use /api/command</span>";
    setStatus("Connected to play API", "ok");
  } catch (_err) {
    const local = await fetchJson("./state.json");
    gameState = local.world;
    offlineMode = true;
    modeEl.innerHTML = "<span class='err'>Offline mode: local simulation fallback only</span>";
    setStatus("API unavailable, running offline fallback", "err");
  }
}

async function runCommand(text) {
  appendLog(`&gt; ${text}`);
  if (offlineMode) {
    applyOfflineCommand(text);
    return;
  }
  try {
    const payload = { text };
    const res = await fetchJson("/api/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const raw = res?.result?.summary || res?.result?.text || res?.result?.dialogue;
    const outcome = typeof raw === "string"
      ? raw
      : raw?.text || raw?.lines?.join("\n") || "Command executed.";
    appendLog(String(outcome));
    if (text.startsWith("move ")) {
      const loc = text.replace("move ", "").trim();
      gameState.agents.player.locationId = loc;
    }
    await refreshEvents();
    renderHUD();
    updateMarkers();
  } catch (err) {
    appendLog(`<span class="err">API error: ${err.message}</span>`);
  }
}

function applyOfflineCommand(text) {
  const [cmd, ...rest] = text.split(" ");
  if (cmd === "move") {
    const loc = rest.join(" ").trim();
    if (gameState.locations[loc]) {
      gameState.agents.player.locationId = loc;
      appendLog(`Player moved to ${gameState.locations[loc].name}.`);
    } else {
      appendLog(`<span class="err">Unknown location: ${loc}</span>`);
    }
  } else if (cmd === "talk" || cmd === "ask") {
    appendLog(`You ${cmd} ${rest.join(" ")}.`);
  } else if (cmd === "inspect") {
    appendLog(`Inspection started: ${rest.join(" ")}`);
  } else if (cmd === "ask_leno") {
    appendLog("Leno: Gather stronger evidence before claiming hidden truth.");
  } else {
    appendLog(`Command accepted (offline): ${text}`);
  }
  renderHUD();
  updateMarkers();
}

async function refreshEvents() {
  if (offlineMode) return;
  try {
    const events = await fetchJson("/api/events");
    const latest = events?.events?.[events.events.length - 1];
    if (latest?.message) appendLog(`Event: ${latest.message}`);
  } catch {
    // Non-fatal for prototype.
  }
}

function renderHUD() {
  const playerLoc = gameState.agents.player.locationId;
  const player = gameState.agents.player;
  const locName = gameState.locations[playerLoc]?.name || playerLoc;
  metaEl.innerHTML = [
    `<span class="pill">Day ${gameState.day}</span>`,
    `<span class="pill">Time ${gameState.time}</span>`,
    `<span class="pill">Location: ${locName}</span>`,
    `<span class="pill">Money: ${player.stats.money}</span>`
  ].join("");

  const buttons = [];
  if (selectedLocationId) {
    buttons.push(makeButton(`Move to ${gameState.locations[selectedLocationId].name}`, () => {
      runCommand(`move ${selectedLocationId}`);
    }));
    buttons.push(makeButton(`Inspect ${gameState.locations[selectedLocationId].name}`, () => {
      runCommand(`inspect ${selectedLocationId}`);
    }));
  }
  if (selectedAgentId) {
    buttons.push(makeButton(`Talk ${selectedAgentId}`, () => runCommand(`talk ${selectedAgentId}`)));
    buttons.push(makeButton(`Ask ${selectedAgentId} delivery`, () => runCommand(`ask ${selectedAgentId} delivery`)));
    buttons.push(makeButton(`Pay ${selectedAgentId} 5`, () => runCommand(`pay ${selectedAgentId} 5`)));
  } else {
    const here = gameState.locations[playerLoc]?.agentsPresent || [];
    for (const agentId of here) {
      if (agentId === "player") continue;
      buttons.push(makeButton(`Talk ${agentId}`, () => runCommand(`talk ${agentId}`)));
    }
  }
  buttons.push(makeButton("Ask Leno", () => runCommand("ask_leno")));
  for (const [id, loc] of Object.entries(gameState.locations)) {
    buttons.push(makeButton(`Go: ${loc.name}`, () => {
      selectedLocationId = id;
      runCommand(`move ${id}`);
    }));
  }
  actionsEl.replaceChildren(...buttons);
}

function makeButton(label, onClick) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

// ----- 3D scene -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a10);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(12, 16, 18);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const key = new THREE.DirectionalLight(0xbfd7ff, 1.0);
key.position.set(14, 24, 10);
scene.add(key);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x0f1827, roughness: 0.9, metalness: 0.1 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickable = [];
let markers = { locations: [], agents: [], player: null };

function clearMarkers() {
  for (const m of [...markers.locations, ...markers.agents]) scene.remove(m);
  if (markers.player) scene.remove(markers.player);
  markers = { locations: [], agents: [], player: null };
  clickable.length = 0;
}

function makeLabel(text, color = "#dce8f7") {
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = 512;
  spriteCanvas.height = 128;
  const ctx = spriteCanvas.getContext("2d");
  ctx.fillStyle = "rgba(8, 12, 20, 0.8)";
  ctx.fillRect(0, 0, spriteCanvas.width, spriteCanvas.height);
  ctx.fillStyle = color;
  ctx.font = "48px sans-serif";
  ctx.fillText(text, 20, 78);
  const tex = new THREE.CanvasTexture(spriteCanvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 1, 1);
  return sprite;
}

function updateMarkers() {
  if (!gameState) return;
  clearMarkers();

  for (const [id, loc] of Object.entries(gameState.locations)) {
    const layout = LOCATION_LAYOUT[id] || { x: 0, z: 0, color: 0x3f4d62 };
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.2, 4.2),
      new THREE.MeshStandardMaterial({ color: layout.color })
    );
    tile.position.set(layout.x, 0.6, layout.z);
    tile.userData = { type: "location", id };
    scene.add(tile);
    clickable.push(tile);
    markers.locations.push(tile);

    const label = makeLabel(loc.name);
    label.position.set(layout.x, 2.3, layout.z);
    scene.add(label);
    markers.locations.push(label);

    for (const agentId of loc.agentsPresent || []) {
      if (agentId === "player") continue;
      const idx = markers.agents.length % 5;
      const npc = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 20, 20),
        new THREE.MeshStandardMaterial({ color: selectedAgentId === agentId ? 0xffcd70 : 0x70b7ff })
      );
      npc.position.set(layout.x - 1.2 + idx * 0.6, 1.8, layout.z - 1.2);
      npc.userData = { type: "agent", id: agentId };
      scene.add(npc);
      clickable.push(npc);
      markers.agents.push(npc);
    }
  }

  const pLocId = gameState.agents.player.locationId;
  const pLayout = LOCATION_LAYOUT[pLocId] || { x: 0, z: 0 };
  const playerMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x83ff9f })
  );
  playerMesh.position.set(pLayout.x, 2.0, pLayout.z + 1.3);
  scene.add(playerMesh);
  markers.player = playerMesh;
}

function onPointerDown(evt) {
  pointer.x = (evt.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(evt.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickable, false)[0];
  if (!hit) return;

  const { type, id } = hit.object.userData;
  if (type === "location") {
    selectedLocationId = id;
    selectedAgentId = null;
    appendLog(`Selected location: ${gameState.locations[id].name}`);
  } else if (type === "agent") {
    selectedAgentId = id;
    selectedLocationId = gameState.agents[id]?.locationId || null;
    appendLog(`Selected agent: ${gameState.agents[id]?.name || id}`);
  }
  renderHUD();
  updateMarkers();
}

window.addEventListener("pointerdown", onPointerDown);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

await loadState();
renderHUD();
updateMarkers();
appendLog("3D prototype loaded.");
appendLog("Select a location or NPC to start.");
animate();
