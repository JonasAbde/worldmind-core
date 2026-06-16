#!/usr/bin/env node
/**
 * release:verify — run the complete WorldMind release gate.
 *
 * Runs all verification steps in sequence. Any failure stops execution.
 *
 * Exit codes:
 *   0 — all gates passed
 *   1 — at least one gate failed
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// NOTE: "npm test" and "npm run ci:gate" are deliberately absent.
// The full test suite (including v20-release-hardening.test.js) already
// invokes `npm run release:verify` directly (not via npm), so running
// "npm test" here would create:
//   npm test → release-verify → ci:gate → npm test  (loop)
// ci:gate is a superset of typecheck+test+check and is validated
// independently by the hardening test via direct node execution.
const STEPS = [
  { name: 'typecheck',  cmd: 'npm run typecheck' },
  { name: 'check',      cmd: 'npm run check' },
  { name: 'play:web',   cmd: 'npm run play:web' },
  { name: 'validate:web-play',  cmd: 'npm run validate:web-play' },
  { name: 'validate:play-server', cmd: 'npm run validate:play-server' },
  { name: 'validate:play-api',    cmd: 'npm run validate:play-api' },
  { name: 'validate:saves-ui',   cmd: 'npm run validate:saves-ui' },
  { name: 'validate:district-ui', cmd: 'npm run validate:district-ui' },
  { name: 'validate:creator',    cmd: 'npm run creator -- validate scenarios/creator-example-district.json' },
  { name: 'validate:leno',       cmd: 'npm run validate:leno' },
  { name: 'demo:play',           cmd: 'npm run demo:play' },
  { name: 'audit:worldmind',     cmd: 'npm run audit:worldmind' },
];

function run(cmd, quiet = false) {
  try {
    const out = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
    });
    if (!quiet) process.stdout.write(`  ✓ ${cmd}\n`);
    return { ok: true, out };
  } catch (err) {
    return { ok: false, err };
  }
}

function checkGeneratedFile(relPath) {
  const full = path.join(process.cwd(), relPath);
  if (!fs.existsSync(full)) {
    return { ok: false, msg: `Missing: ${relPath}` };
  }
  return { ok: true };
}

async function main() {
  process.stdout.write('WorldMind Release Gate\n');
  process.stdout.write('='.repeat(40) + '\n');

  // 1. Static generated file hygiene
  process.stdout.write('\n[1/3] Static file hygiene\n');
  const checks = [
    { label: 'static-play/index.html',    check: () => checkGeneratedFile('static-play/index.html') },
    { label: 'static-play/state.json',    check: () => checkGeneratedFile('static-play/state.json') },
    { label: 'no .sqlite committed',      check: () => {
      try {
        const r = execSync('git ls-files --cached "*.sqlite" "data/*.sqlite"', { encoding: 'utf8' });
        return r.trim() === '' ? { ok: true } : { ok: false, msg: `Found committed sqlite: ${r.trim()}` };
      } catch {
        return { ok: true };
      }
    }},
    { label: 'no hiddenCause in HTML',   check: () => {
      try {
        const html = fs.readFileSync('static-play/index.html', 'utf8');
        const SECRET = 'Nadia planted a false rumor';
        return html.includes(SECRET)
          ? { ok: false, msg: 'hiddenCause text found in static HTML' }
          : { ok: true };
      } catch {
        return { ok: false, msg: 'Could not read static HTML' };
      }
    }},
    { label: 'creator example pack valid', check: () => {
      try {
        const data = JSON.parse(fs.readFileSync('scenarios/creator-example-district.json', 'utf8'));
        return data.kind === 'scenario' && data.id === 'creator_example'
          ? { ok: true }
          : { ok: false, msg: 'creator-example-district.json invalid' };
      } catch (e) {
        return { ok: false, msg: `creator-example-district.json: ${e.message}` };
      }
    }},
  ];

  let hygieneOk = true;
  for (const { label, check } of checks) {
    const result = check();
    process.stdout.write(`  ${result.ok ? '✓' : '✗'} ${label}${result.msg ? ` — ${result.msg}` : ''}\n`);
    if (!result.ok) hygieneOk = false;
  }

  if (!hygieneOk) {
    process.stdout.write('\n✗ Hygiene checks failed.\n');
    process.exit(1);
  }

  // 2. Command gates
  process.stdout.write('\n[2/3] Command gates\n');
  let allOk = true;
  for (const step of STEPS) {
    const result = run(step.cmd);
    if (!result.ok) {
      process.stdout.write(`  ✗ ${step.name} — exit ${result.err.status}\n`);
      if (result.err.stdout) process.stdout.write(result.err.stdout.slice(0, 200) + '\n');
      if (result.err.stderr) process.stdout.write(result.err.stderr.slice(0, 200) + '\n');
      allOk = false;
    }
  }

  if (!allOk) {
    process.stdout.write('\n✗ Command gate failed.\n');
    process.exit(1);
  }

  // 3. Git state
  process.stdout.write('\n[3/3] Git state\n');
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    process.stdout.write(`  ✓ Branch: ${branch}\n`);
    if (dirty) {
      process.stdout.write(`  ! Warning: uncommitted changes:\n${dirty.split('\n').map(l => '    ' + l).join('\n')}\n`);
    } else {
      process.stdout.write('  ✓ Working tree clean\n');
    }
  } catch (e) {
    process.stdout.write(`  ! Could not read git state: ${e.message}\n`);
  }

  process.stdout.write('\n✓ All release gates passed.\n');
  process.exit(0);
}

main();
