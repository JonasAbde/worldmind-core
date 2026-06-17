/**
 * WorldMind Authoring Panel (v1.0-rc20).
 *
 * Reads /api/content (GET) and saves via /api/content (POST).
 * Validates against the rc12 JSON schema before saving (server-side).
 * Hot-reload: after save, the play-server's content cache is invalidated
 * so the next /api/state call reads from disk.
 */
const PACK_URL = '/api/content';
const STATUS = document.getElementById('wm-status');
const TABS = document.getElementById('wm-tabs');
const EDITOR = document.getElementById('wm-editor');
const TITLE = document.getElementById('wm-section-title');
const HELP = document.getElementById('wm-section-help');
const STATS = document.getElementById('wm-section-stats');
const KEY_INPUT = document.getElementById('wm-key');
const SAVE = document.getElementById('wm-save');
const RELOAD = document.getElementById('wm-reload');
const FORMAT = document.getElementById('wm-format');

const SECTIONS = {
  dialogue: {
    title: 'Dialogue',
    help: 'Edit the dialogue array. Each entry needs id, agentId, topic, line. The unlocks array produces evidence gates.',
    field: 'dialogue',
    singular: 'entry'
  },
  resolutionPaths: {
    title: 'Resolution Paths',
    help: 'Edit resolution paths. Each path needs id, label, risk, steps[] of command strings.',
    field: 'resolutionPaths',
    singular: 'path'
  },
  incidents: {
    title: 'Incidents',
    help: 'Edit incidents. Each incident needs id, title, locationId, riskLevel.',
    field: 'incidents',
    singular: 'incident'
  },
  rumors: {
    title: 'Rumors',
    help: 'Edit rumors. Each rumor needs id, claim, truthLevel ∈ {true, false_or_misleading, partial, unverified}.',
    field: 'rumors',
    singular: 'rumor'
  },
  evidence: {
    title: 'Evidence',
    help: 'Edit evidence. Each entry needs id, label/title, and discovery conditions.',
    field: 'evidence',
    singular: 'piece'
  }
};

let currentSection = 'dialogue';
let fullPack = null;

function setStatus(text, kind = 'idle') {
  STATUS.textContent = text;
  STATUS.className = `wm-author-status ${kind}`;
}

function authHeaders() {
  const k = KEY_INPUT.value.trim();
  const h = { 'content-type': 'application/json' };
  if (k) h['x-author-key'] = k;
  return h;
}

async function loadPack() {
  setStatus('Loading content pack…');
  try {
    const r = await fetch(PACK_URL, { headers: authHeaders() });
    if (!r.ok) {
      if (r.status === 401) { setStatus('Auth required: enter the author key above.', 'error'); return; }
      throw new Error(`HTTP ${r.status}`);
    }
    fullPack = await r.json();
    renderSection(currentSection);
    setStatus(`Loaded content-pack v${fullPack.version || 1} (${Object.keys(SECTIONS).length} sections)`, 'ok');
  } catch (e) {
    setStatus(`Load failed: ${e.message}`, 'error');
  }
}

function renderSection(key) {
  const def = SECTIONS[key];
  TITLE.textContent = def.title;
  HELP.textContent = def.help;
  const arr = (fullPack && fullPack[def.field]) || [];
  EDITOR.value = JSON.stringify(arr, null, 2);
  STATS.textContent = `${arr.length} ${def.singular}${arr.length === 1 ? '' : 's'}`;
  // Update tab styles
  for (const btn of TABS.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.section === key);
  }
  currentSection = key;
}

async function saveSection() {
  if (!fullPack) { setStatus('No content pack loaded.', 'error'); return; }
  const def = SECTIONS[currentSection];
  let parsed;
  try {
    parsed = JSON.parse(EDITOR.value);
  } catch (e) {
    setStatus(`Parse error: ${e.message}`, 'error');
    return;
  }
  if (!Array.isArray(parsed)) {
    setStatus('Editor content must be a JSON array.', 'error');
    return;
  }
  // Local update + write to server
  fullPack[def.field] = parsed;
  try {
    const r = await fetch(PACK_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(fullPack)
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`HTTP ${r.status}: ${errText.slice(0, 200)}`);
    }
    const result = await r.json();
    setStatus(`Saved ${def.field} (${parsed.length} ${def.singular}${parsed.length === 1 ? '' : 's'}) — pack version now ${result.version || '?'}`, 'ok');
    STATS.textContent = `${parsed.length} ${def.singular}${parsed.length === 1 ? '' : 's'} (saved)`;
  } catch (e) {
    setStatus(`Save failed: ${e.message}`, 'error');
  }
}

function reloadFromDisk() {
  loadPack();
}

function formatJSON() {
  try {
    const parsed = JSON.parse(EDITOR.value);
    EDITOR.value = JSON.stringify(parsed, null, 2);
    setStatus('Formatted.', 'ok');
  } catch (e) {
    setStatus(`Parse error: ${e.message}`, 'error');
  }
}

TABS.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-section]');
  if (btn) renderSection(btn.dataset.section);
});
SAVE.addEventListener('click', saveSection);
RELOAD.addEventListener('click', reloadFromDisk);
FORMAT.addEventListener('click', formatJSON);
EDITOR.addEventListener('keydown', (e) => {
  // Ctrl/Cmd+S saves
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveSection();
  }
});

loadPack();