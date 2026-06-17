#!/usr/bin/env node
/**
 * wm-assets — Node wrapper for the Python GLB asset builder.
 *
 * Invokes tools/build-glb.py with the right Python interpreter and
 * surfaces the JSON output. Used by npm run scripts and ci:gate so
 * asset generation is a first-class build step.
 *
 * Usage:
 *   node tools/wm-assets.js build [--out=DIR] [--kind=all|location|character] [--id=ID]
 *   node tools/wm-assets.js validate [--out=DIR]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..');

function findPython() {
  // Prefer absolute path to Hermes-bundled Python if it exists, since
  // it has numpy/trimesh/pygltflib already installed and matches pip's env.
  const hermesPy = path.join(
    process.env.LOCALAPPDATA || 'C:\\Users\\empir\\AppData\\Local',
    'hermes', 'hermes-agent', 'venv', 'Scripts', 'python.exe'
  );
  if (existsSync(hermesPy)) return hermesPy;
  for (const cmd of ['python3', 'python']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return cmd;
  }
  throw new Error('Python 3 not found on PATH. Install Python 3.10+ or set WMINDS_PYTHON env var.');
}

function runPython(args) {
  const py = process.env.WMINDS_PYTHON || findPython();
  const scriptPath = path.join(__dirname, 'build-glb.py');
  const r = spawnSync(py, [scriptPath, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.stdout) process.stdout.write(r.stdout);
  return r;
}

function parseFlags(argv) {
  const flags = { out: null, kind: null, id: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) { flags.out = argv[++i]; }
    else if (a.startsWith('--out=')) { flags.out = a.slice('--out='.length); }
    else if (a === '--kind' && argv[i + 1]) { flags.kind = argv[++i]; }
    else if (a.startsWith('--kind=')) { flags.kind = a.slice('--kind='.length); }
    else if (a === '--id' && argv[i + 1]) { flags.id = argv[++i]; }
    else if (a.startsWith('--id=')) { flags.id = a.slice('--id='.length); }
  }
  return flags;
}

function main() {
  const [, , subcommand, ...rest] = process.argv;
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    process.stdout.write(`wm-assets — WorldMind GLB asset builder

Usage:
  node tools/wm-assets.js build [--out=DIR] [--kind=all|location|character] [--id=ID]
  node tools/wm-assets.js validate [--out=DIR]

Reads tools/build-glb.py under the hood. Surfaces its JSON output.
`);
    process.exit(0);
  }

  const flags = parseFlags(rest);
  const args = [];
  if (flags.out) args.push('--out', flags.out);
  if (flags.kind) args.push('--kind', flags.kind);
  if (flags.id) args.push('--id', flags.id);

  if (subcommand === 'build') {
    const r = runPython(args.length ? args : []);
    process.exit(r.status ?? 0);
  }
  if (subcommand === 'validate') {
    const r = runPython(['--validate', ...(flags.out ? ['--out', flags.out] : [])]);
    process.exit(r.status ?? 0);
  }
  process.stderr.write(`unknown subcommand: ${subcommand}\n`);
  process.exit(2);
}

main();