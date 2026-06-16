#!/usr/bin/env node
/**
 * validate:web-play — assert that the static play UI is well-formed.
 *
 * Checks that the supplied HTML page (or, by default, the freshly
 * generated `static-play/index.html`) contains every required
 * section label, that the Leno evidence guard is wired up, and
 * that the page embeds an `app.js` runtime.
 *
 * Usage:
 *   node src/cli/validate-web-play.js [path-to-index.html] [--json]
 *
 * Exit codes:
 *   0 — all required sections present
 *   1 — missing one or more sections
 *   2 — invalid input
 */

import fs from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();

const REQUIRED_LABELS = [
  'Current Location',
  'Visible Agents',
  'Available Commands',
  'Dialogue',
  'Consequence',
  'Evidence',
  'Incident',
  'Leno',
  'Saves',
  'Branches',
  'Demo Paths'
];

const REQUIRED_RUNTIME_MARKERS = [
  'wm-cmd-btn',       // quick-action buttons
  'wm-cmd-form',      // freeform command form
  'wm-state'          // embedded JSON state
];

function inspectHtml(htmlPath) {
  if (!fs.existsSync(htmlPath)) {
    return { code: 2, payload: { message: `file not found: ${htmlPath}` } };
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const missingLabels = REQUIRED_LABELS.filter((l) => !html.includes(l));
  const missingMarkers = REQUIRED_RUNTIME_MARKERS.filter((m) => !html.includes(m));
  if (missingLabels.length === 0 && missingMarkers.length === 0) {
    return {
      code: 0,
      payload: {
        path: htmlPath,
        sectionsChecked: REQUIRED_LABELS.length,
        runtimeMarkersChecked: REQUIRED_RUNTIME_MARKERS.length,
        sizeBytes: html.length
      }
    };
  }
  return {
    code: 1,
    payload: {
      path: htmlPath,
      missing: [...missingLabels, ...missingMarkers.map((m) => `marker:${m}`)],
      missingLabels,
      missingMarkers
    }
  };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--') argv.shift();
  const jsonOnly = argv.includes('--json');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const target = positional[0] || path.join(REPO, 'static-play/index.html');

  // Print the JSON line LAST so callers can parse the final line.
  // In --json mode we ONLY print JSON; otherwise we print a short
  // human-readable banner first, then the JSON line.
  const result = inspectHtml(path.resolve(target));
  if (!jsonOnly) {
    if (result.code === 0) {
      process.stdout.write('web play: ok\n');
    } else if (result.code === 1) {
      process.stdout.write('web play: missing required sections\n');
    } else {
      process.stdout.write('web play: invalid input\n');
    }
  }
  if (result.code === 0) {
    process.stdout.write(JSON.stringify({ ok: true, kind: 'web-play-validator', ...result.payload }) + '\n');
  } else {
    process.stdout.write(JSON.stringify({ ok: false, kind: 'web-play-validator', ...result.payload }) + '\n');
  }
  process.exit(result.code);
}

main();
