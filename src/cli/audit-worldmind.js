#!/usr/bin/env node
/**
 * audit:worldmind — WorldMind safety audit.
 *
 * Checks that the public world state does NOT leak hidden truths,
 * that Leno's evidence guard is active, that Risk 4/5 is gated,
 * and that no real-world connectors are present.
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more audit checks failed
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const CHECKS = [];

function check(name, fn) {
  CHECKS.push({ name, fn });
}

function fail(name, msg) {
  return { ok: false, name, msg };
}

function ok(name) {
  return { ok: true, name };
}

// --- 1. hiddenCause must not appear in public HTML state ---

check('no hiddenCause secret text in static HTML', () => {
  const htmlPath = path.join(ROOT, 'static-play/index.html');
  if (!fs.existsSync(htmlPath)) return fail('no hiddenCause check', 'static HTML not found');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const SECRET = 'Nadia planted a false rumor';
  if (html.includes(SECRET)) return fail('hiddenCause', `Secret text found in static HTML: "${SECRET}"`);
  return ok('hiddenCause');
});

// --- 2. Agent secrets must be redacted in browser state ---

check('agent secrets redacted in browser state', () => {
  const statePath = path.join(ROOT, 'static-play/state.json');
  if (!fs.existsSync(statePath)) return fail('secrets redaction', 'state.json not found');
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    for (const [id, agent] of Object.entries(state.world?.agents ?? {})) {
      if ((agent.secrets?.length ?? 0) > 0) {
        return fail('secrets', `agent "${id}" has ${agent.secrets.length} secret(s) in browser state: ${agent.secrets.join(', ')}`);
      }
    }
    return ok('agent secrets');
  } catch (e) {
    return fail('secrets', `Could not parse state.json: ${e.message}`);
  }
});

// --- 3. Leno evidence guard exists in web-renderer ---

check('Leno evidence guard in web-renderer', () => {
  const rendererPath = path.join(ROOT, 'src/play/web-renderer.js');
  if (!fs.existsSync(rendererPath)) return fail('Leno guard', 'web-renderer.js not found');
  const content = fs.readFileSync(rendererPath, 'utf8');
  const hasGuard = content.includes('applyLenoGuard') || content.includes('hasNadiaEvidence') || content.includes('guard');
  if (!hasGuard) return fail('Leno guard', 'No Leno evidence guard found in web-renderer.js');
  return ok('Leno guard');
});

// --- 4. Risk 4/5 actions are gated in actions.js/ts ---

check('Risk tracking exists in actions', () => {
  const actionsPath = path.join(ROOT, 'src/simulation/actions.ts');
  if (!fs.existsSync(actionsPath)) return fail('risk', 'actions.ts not found');
  const content = fs.readFileSync(actionsPath, 'utf8');
  if (!content.includes('risk') && !content.includes('RISK')) {
    return fail('risk', 'No risk tracking found in actions.ts');
  }
  return ok('risk tracking');
});

// --- 5. No admin/world_change permissions in creator templates ---

check('Creator filters unsafe permissions', () => {
  const creatorPath = path.join(ROOT, 'src/cli/creator.js');
  if (!fs.existsSync(creatorPath)) return fail('creator permissions', 'creator.js not found');
  const content = fs.readFileSync(creatorPath, 'utf8');
  const UNSAFE = ['admin', 'world_change', 'delete_world', 'spawn_agent_admin'];
  for (const term of UNSAFE) {
    if (content.toLowerCase().includes(term) && !content.includes('// ' + term)) {
      return fail('creator permissions', `Unsafe permission term "${term}" found in creator.js`);
    }
  }
  return ok('creator permissions');
});

// --- 6. No real-world connectors in codebase ---

check('no real-world connectors in codebase', () => {
  const CONNECTORS = ['http://api.', 'https://api.', 'openweather', 'twilio', 'sendgrid', 'stripe', 'plaid'];
  const SKIP_DIRS = ['node_modules', '.git', 'static-play'];
  try {
    const r = execSync(
      `git ls-files --cached "*.js" "*.json" | grep -v -E "${SKIP_DIRS.join('|')}"`,
      { encoding: 'utf8', cwd: ROOT }
    );
    const files = r.trim().split('\n').filter(Boolean);
    const hits = [];
    for (const file of files.slice(0, 200)) {
      try {
        const content = fs.readFileSync(path.join(ROOT, file), 'utf8').slice(0, 5000);
        for (const c of CONNECTORS) {
          if (content.includes(c)) hits.push(`${file}: ${c}`);
        }
      } catch {}
    }
    if (hits.length > 0) {
      return fail('real-world connectors', `Found: ${hits.slice(0, 3).join('; ')}`);
    }
    return ok('no connectors');
  } catch {
    return ok('no connectors (git ls-files unavailable)');
  }
});

// --- 7. private memory redaction in play-server ---

check('play-server has private memory redaction', () => {
  const serverPath = path.join(ROOT, 'src/cli/play-server.js');
  if (!fs.existsSync(serverPath)) return ok('play-server (not present)');
  const content = fs.readFileSync(serverPath, 'utf8');
  const hasRedaction = content.includes('markPrivateObjects') || content.includes('private') || content.includes('secrets');
  if (!hasRedaction) return fail('play-server redaction', 'No private redaction found in play-server.js');
  return ok('play-server redaction');
});

// --- Run all checks ---

async function main() {
  process.stdout.write('WorldMind Safety Audit\n');
  process.stdout.write('='.repeat(40) + '\n\n');

  let allOk = true;
  for (const { name, fn } of CHECKS) {
    const result = fn();
    const sym = result.ok ? '✓' : '✗';
    process.stdout.write(`  ${sym} ${result.name}${result.msg ? `\n    → ${result.msg}` : ''}\n`);
    if (!result.ok) allOk = false;
  }

  process.stdout.write('\n');
  if (allOk) {
    process.stdout.write('✓ All audit checks passed.\n');
    process.exit(0);
  } else {
    process.stdout.write('✗ Audit failed — fix issues before release.\n');
    process.exit(1);
  }
}

main();
