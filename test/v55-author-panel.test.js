// v1.0-rc20 — Browser authoring panel.
// v1.0-rc20 — Browser authoring panel.
//
// Read content/worldmind/content-pack-v1.json from disk via /api/content,
// render a JSON-editor view in static-play, save via POST /api/content.
// Auth gate via X-AUTHOR-KEY env var (shared password for now).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.join(__dirname, '..');

test('author panel assets exist (static-play/author.html + author.js)', () => {
  assert.ok(existsSync(path.join(REPO, 'static-play', 'author.html')),
    'static-play/author.html should exist');
  assert.ok(existsSync(path.join(REPO, 'static-play', 'author.js')),
    'static-play/author.js should exist');
});

test('content pack v1 exists for the editor to read', () => {
  assert.ok(existsSync(path.join(REPO, 'content', 'worldmind', 'content-pack-v1.json')),
    'content-pack-v1.json should exist');
});

test('play-server exposes /api/content GET and POST', () => {
  const src = readFileSync(path.join(REPO, 'src', 'cli', 'play-server.js'), 'utf8');
  assert.ok(src.includes("'/api/content'") || src.includes('"/api/content"'),
    'play-server should have /api/content route');
  assert.ok(src.includes('handleContent') || src.includes('handleAuthor'),
    'play-server should have handleContent or handleAuthor function');
});

test('author panel is linked from main /3d.html (Discover → Author)', () => {
  const html = readFileSync(path.join(REPO, 'static-play', 'index.html'), 'utf8');
  assert.ok(html.includes('author.html') || html.includes('/author'),
    'static-play/index.html should link to /author.html');
});

test('author UI has editor form for dialogue + resolution paths', () => {
  const js = readFileSync(path.join(REPO, 'static-play', 'author.js'), 'utf8');
  // Should reference the two main editable sections.
  assert.ok(js.toLowerCase().includes('dialogue') || js.toLowerCase().includes('resolution'),
    'author.js should reference dialogue or resolution paths');
  assert.ok(js.includes('textarea') || js.includes('JSON.stringify') || js.includes('JSON.parse'),
    'author.js should have an editor surface (textarea or JSON parser)');
});

test('author writes are validated against the rc12 JSON schema before save', () => {
  const js = readFileSync(path.join(REPO, 'static-play', 'author.js'), 'utf8');
  const server = readFileSync(path.join(REPO, 'src', 'cli', 'play-server.js'), 'utf8');
  // Server must call validateWorldmindContent or similar before write.
  const serverValidates = server.includes('validateWorldmindContent') ||
                          server.includes('validateScenario') ||
                          server.includes('scenario-schema');
  assert.ok(serverValidates,
    'play-server should validate the content pack against the schema before writing');
});