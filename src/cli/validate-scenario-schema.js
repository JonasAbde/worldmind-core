#!/usr/bin/env node
/**
 * validate-scenario-schema — auditerer at alle content/* packs følger
 * den lille JSON-Schema defineret i src/play/scenario-schema.js
 * (v1.0-rc12). Dependency-light MVP — ingen ekstern JSON-Schema lib.
 *
 * JSON på sidste linje til ci:gate.
 */
import { validateAllScenarios, SCHEMA_VERSION } from '../play/scenario-schema.js';

const result = validateAllScenarios();
const checks = [];
function check(name, ok, detail = null) {
  checks.push({ name, ok, detail });
}

// Re-derive individual checks for the report.
check('schema version declared', !!SCHEMA_VERSION, { version: SCHEMA_VERSION });
check('all episodes valid', result.errors.filter(e => e.startsWith('episode[')).length === 0, {
  count: result.counts.episodes
});
check('all resolution paths valid', result.errors.filter(e => e.startsWith('path[')).length === 0, {
  count: result.counts.resolutionPaths
});
check('all incidents valid', result.errors.filter(e => e.startsWith('incidents[')).length === 0, {
  count: result.counts.incidents
});
check('all rumors valid', result.errors.filter(e => e.startsWith('rumors[')).length === 0, {
  count: result.counts.rumors
});
check('all evidence valid', result.errors.filter(e => e.startsWith('evidence[')).length === 0, {
  count: result.counts.evidence
});
check('all dialogue entries valid', result.errors.filter(e => e.startsWith('dialogue[')).length === 0, {
  count: result.counts.dialogue
});
check('full pack passes schema', result.ok, {
  totalErrors: result.errors.length,
  counts: result.counts
});

const allOk = checks.every(c => c.ok);
process.stdout.write(JSON.stringify({
  ok: allOk,
  kind: 'scenario-schema-validator',
  schemaVersion: SCHEMA_VERSION,
  counts: result.counts,
  errors: result.errors,
  checks
}) + '\n');
process.exit(allOk ? 0 : 1);