#!/usr/bin/env node
/**
 * wm-textures — Node wrapper for the Python procedural texture builder.
 *
 * Auto-detects Hermes-bundled Python (which has Pillow pre-installed).
 * Surfaces JSON output.
 *
 * Usage:
 *   node tools/build-textures.js --material=wood --out=assets/textures/wood.png
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..');

function findPython() {
  const hermesPy = path.join(
    process.env.LOCALAPPDATA || 'C:\\Users\\empir\\AppData\\Local',
    'hermes', 'hermes-agent', 'venv', 'Scripts', 'python.exe'
  );
  if (existsSync(hermesPy)) return hermesPy;
  for (const cmd of ['python3', 'python']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return cmd;
  }
  throw new Error('Python 3 not found');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`wm-textures — WorldMind procedural texture builder

Usage:
  node tools/build-textures.js --material=wood --out=path/to/file.png [--size=256] [--seed=1]

Materials: wood, brick, concrete, metal, neon, fabric

Reads tools/build-textures.py under the hood.
`);
    process.exit(0);
  }
  const py = process.env.WMINDS_PYTHON || findPython();
  const scriptPath = path.join(__dirname, 'build-textures.py');
  const r = spawnSync(py, [scriptPath, ...args], {
    cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.stdout) process.stdout.write(r.stdout);
  process.exit(r.status ?? 1);
}

main();