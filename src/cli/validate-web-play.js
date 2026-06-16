#!/usr/bin/env node
/**
 * validate:web-play — assert that the static play UI is well-formed.
 *
 * Checks required section labels, runtime markers, visual gameplay shell
 * markers, leak guards, and referenced asset paths.
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
  'wm-cmd-btn',
  'wm-cmd-form',
  'wm-state'
];

const VISUAL_SHELL_MARKERS = [
  'data-scene-img',
  'wm-hotspot-run',
  'data-run-command',
  'wm-npc-portrait',
  'data-case-board',
  'data-rumor-trail',
  'data-founder-panel',
  'data-major-decision-modal',
  'data-consequence-ticker',
  'data-game-shell'
];

const FORBIDDEN_LEAK_PATTERNS = [
  /"hiddenCause"\s*:\s*"[^"]+"/i,
  /"hiddenCause"\s*:\s*\{/i,
  /"secrets"\s*:\s*\[\s*"[^"]+"/i,
  /\bnadia\s+is\s+the\s+source\b/i
];

function extractAssetRefs(html) {
  const refs = new Set();
  const re = /(?:src|href)=["'](assets\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    refs.add(m[1]);
  }
  return [...refs];
}

function inspectHtml(htmlPath) {
  if (!fs.existsSync(htmlPath)) {
    return { code: 2, payload: { message: `file not found: ${htmlPath}` } };
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const missingLabels = REQUIRED_LABELS.filter((l) => !html.includes(l));
  const missingMarkers = REQUIRED_RUNTIME_MARKERS.filter((m) => !html.includes(m));
  const missingVisual = VISUAL_SHELL_MARKERS.filter((m) => !html.includes(m));
  const leakHits = FORBIDDEN_LEAK_PATTERNS.filter((re) => re.test(html)).map((re) => re.source);

  const assetRefs = extractAssetRefs(html);
  const missingAssets = assetRefs.filter((ref) => !fs.existsSync(path.join(REPO, ref)));

  const problems = [
    ...missingLabels,
    ...missingMarkers.map((m) => `marker:${m}`),
    ...missingVisual.map((m) => `visual:${m}`),
    ...leakHits.map((h) => `leak:${h}`),
    ...missingAssets.map((a) => `asset:${a}`)
  ];

  if (problems.length === 0) {
    return {
      code: 0,
      payload: {
        path: htmlPath,
        sectionsChecked: REQUIRED_LABELS.length,
        runtimeMarkersChecked: REQUIRED_RUNTIME_MARKERS.length,
        visualMarkersChecked: VISUAL_SHELL_MARKERS.length,
        assetsChecked: assetRefs.length,
        sizeBytes: html.length
      }
    };
  }
  return {
    code: 1,
    payload: {
      path: htmlPath,
      missing: problems,
      missingLabels,
      missingMarkers,
      missingVisual,
      leakHits,
      missingAssets
    }
  };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--') argv.shift();
  const jsonOnly = argv.includes('--json');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const target = positional[0] || path.join(REPO, 'static-play/index.html');

  const result = inspectHtml(path.resolve(target));
  if (!jsonOnly) {
    if (result.code === 0) {
      process.stdout.write('web play: ok\n');
    } else if (result.code === 1) {
      process.stdout.write('web play: missing required sections or visual shell markers\n');
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
