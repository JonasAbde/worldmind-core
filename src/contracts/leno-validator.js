/**
 * Leno evidence-guard auditor (programmatic API).
 *
 * The full CLI lives in `src/cli/validate-leno.js`. This file
 * exposes the auditor as a pure function so other CLIs and tests
 * can import it without invoking the CLI's `main()`.
 */

import { runSimulation } from '../simulation/sim.ts';
import { lenoSummarize } from '../simulation/leno.ts';

// Source-defining mentions of a sensitive name are HARD leaks.
const SOURCE_DEFINING_PATTERNS = [
  /\bnadia\s+is\s+the\s+source\b/i,
  /\bnadia\s+is\s+the\s+cause\b/i,
  /\bnadia\s+caused\b/i,
  /\bnadia\s+started\b/i,
  /\bnadia\s+is\s+responsible\b/i,
  /\bnadia\s+is\s+guilty\b/i,
  /\bnadia\s+did\s+it\b/i
];

const HIDDEN_CAUSE_RE = /\bhidden\s+cause\b/i;

function hasNadiaEvidence(world) {
  if (!world) return false;
  return Boolean(world.playerKnowledge?.evidenceIds?.includes?.('rumor_source_nadia'));
}

export function validateLenoSummary(text, world) {
  const findings = [];
  if (typeof text !== 'string') text = String(text ?? '');

  const evidencePermitsNadia = hasNadiaEvidence(world);

  for (const pat of SOURCE_DEFINING_PATTERNS) {
    if (pat.test(text)) {
      if (evidencePermitsNadia) {
        findings.push({ rule: 'nadia-source-with-evidence', ok: true, evidence: 'rumor_source_nadia', pattern: pat.source });
      } else {
        findings.push({ rule: 'nadia-source-without-evidence', ok: false, pattern: pat.source });
      }
    }
  }

  if (HIDDEN_CAUSE_RE.test(text) && !evidencePermitsNadia) {
    findings.push({ rule: 'hidden-cause-leak', ok: false });
  }

  const nadiaMentions = (text.match(/\bnadia\b/gi) || []).length;
  if (nadiaMentions > 0 && !evidencePermitsNadia) {
    const alreadyFlagged = findings.some((f) => f.rule && f.rule.startsWith('nadia-source-'));
    if (!alreadyFlagged) {
      findings.push({ rule: 'nadia-mention-without-evidence', ok: true, count: nadiaMentions, note: 'soft warning only' });
    }
  }

  const leaks = findings.filter((f) => !f.ok);
  return { ok: leaks.length === 0, leaks: leaks.length, findings };
}

/**
 * Convenience: build the Leno summary for a scenario and audit it.
 */
export function auditScenarioSummary(scenarioPath, days = 1) {
  const world = runSimulation({ days, scenarioPath, persistToSqlite: false, writeScenario: false });
  const text = lenoSummarize(world, { scope: 'world' });
  return { world, text, audit: validateLenoSummary(text, world) };
}
