/**
 * WorldMind Scenario Schema Validation (v1.0-rc12).
 *
 * Plan 54 medium-term target: "Add a JSON Schema for content packs
 * so authoring errors are caught at load time."
 *
 * Lightweight shape validator (no external JSON Schema library —
 * dependency-light MVP). Returns { ok, errors[] } for each shape.
 *
 * Schemas enforced:
 *   - Episode: id, title, status, district, themes[], requiredSystems[]
 *   - ResolutionPath: id, label, risk ∈ low|medium|high, steps[], reward{}
 *   - Incident: id, title, locationId, riskLevel ∈ low|medium|high, status, linkedEvidence[]
 *   - Rumor: id, claim, truthLevel ∈ true|false_or_misleading|partial|unverified, sourceEvidenceId
 *   - Evidence: id, title, category
 *   - DialogueEntry: id, agentId, topic, tone, line, unlocks[]
 */

import { loadAllScenarios, listEpisodes, getEpisodeSteps, getEpisodeOutcomes, loadResolutionPath, listResolutionPaths } from './scenario-loader.js';

export const SCHEMA_VERSION = '1.0';

const VALID_RISK = new Set(['low', 'medium', 'high']);
const VALID_TRUTH = new Set(['true', 'false_or_misleading', 'partial', 'unverified']);

function shape(input, checks, required = []) {
  const errors = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['shape: must be an object'] };
  }
  for (const field of required) {
    if (input[field] === undefined || input[field] === null) {
      errors.push(`missing required field: ${field}`);
    }
  }
  for (const [field, validator] of Object.entries(checks)) {
    if (input[field] !== undefined && !validator(input[field])) {
      errors.push(`invalid value for field: ${field}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateEpisodeShape(ep) {
  if (!ep || typeof ep !== 'object') return { ok: false, errors: ['episode must be an object'] };
  const errors = [];
  for (const f of ['id', 'title', 'district']) {
    if (!ep[f] || typeof ep[f] !== 'string') errors.push(`episode.${f} must be a non-empty string`);
  }
  if (ep.themes !== undefined && !Array.isArray(ep.themes)) errors.push('episode.themes must be an array');
  if (ep.requiredSystems !== undefined && !Array.isArray(ep.requiredSystems)) errors.push('episode.requiredSystems must be an array');
  return { ok: errors.length === 0, errors };
}

export function validateResolutionPathShape(rp) {
  if (!rp || typeof rp !== 'object') return { ok: false, errors: ['path must be an object'] };
  const errors = [];
  if (!rp.id || typeof rp.id !== 'string') errors.push('path.id must be a non-empty string');
  if (!rp.label || typeof rp.label !== 'string') errors.push('path.label must be a non-empty string');
  if (rp.risk !== undefined && !VALID_RISK.has(rp.risk)) errors.push(`path.risk must be one of ${[...VALID_RISK].join('|')}`);
  if (rp.steps !== undefined && !Array.isArray(rp.steps)) errors.push('path.steps must be an array');
  return { ok: errors.length === 0, errors };
}

export function validateIncidentShape(inc) {
  if (!inc || typeof inc !== 'object') return { ok: false, errors: ['incident must be an object'] };
  const errors = [];
  if (!inc.id || typeof inc.id !== 'string') errors.push('incident.id must be a non-empty string');
  if (!inc.title || typeof inc.title !== 'string') errors.push('incident.title must be a non-empty string');
  if (inc.riskLevel !== undefined && !VALID_RISK.has(inc.riskLevel)) errors.push(`incident.riskLevel must be one of ${[...VALID_RISK].join('|')}`);
  if (inc.linkedEvidence !== undefined && !Array.isArray(inc.linkedEvidence)) errors.push('incident.linkedEvidence must be an array');
  return { ok: errors.length === 0, errors };
}

export function validateRumorShape(r) {
  if (!r || typeof r !== 'object') return { ok: false, errors: ['rumor must be an object'] };
  const errors = [];
  if (!r.id || typeof r.id !== 'string') errors.push('rumor.id must be a non-empty string');
  if (!r.claim || typeof r.claim !== 'string') errors.push('rumor.claim must be a non-empty string');
  if (r.truthLevel !== undefined && !VALID_TRUTH.has(r.truthLevel)) errors.push(`rumor.truthLevel must be one of ${[...VALID_TRUTH].join('|')}`);
  if (r.sourceEvidenceId !== undefined && typeof r.sourceEvidenceId !== 'string') errors.push('rumor.sourceEvidenceId must be a string');
  return { ok: errors.length === 0, errors };
}

export function validateEvidenceShape(e) {
  if (!e || typeof e !== 'object') return { ok: false, errors: ['evidence must be an object'] };
  const errors = [];
  if (!e.id || typeof e.id !== 'string') errors.push('evidence.id must be a non-empty string');
  // title or label required (the content pack uses label; older content uses title)
  if (!e.title && !e.label) errors.push('evidence must have title or label');
  if (e.category !== undefined && typeof e.category !== 'string') errors.push('evidence.category must be a string');
  if (e.label !== undefined && typeof e.label !== 'string') errors.push('evidence.label must be a string');
  return { ok: errors.length === 0, errors };
}

export function validateDialogueEntryShape(d) {
  if (!d || typeof d !== 'object') return { ok: false, errors: ['dialogue must be an object'] };
  const errors = [];
  if (!d.id || typeof d.id !== 'string') errors.push('dialogue.id must be a non-empty string');
  if (!d.agentId || typeof d.agentId !== 'string') errors.push('dialogue.agentId must be a non-empty string');
  if (!d.topic || typeof d.topic !== 'string') errors.push('dialogue.topic must be a non-empty string');
  if (!d.line || typeof d.line !== 'string') errors.push('dialogue.line must be a non-empty string');
  return { ok: errors.length === 0, errors };
}

export function validatePackShape(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object') return { ok: false, errors: ['pack must be an object'] };
  for (const inc of pack.incidents || []) {
    const r = validateIncidentShape(inc);
    if (!r.ok) errors.push(...r.errors.map(e => `incidents[${inc?.id || '?'}]: ${e}`));
  }
  for (const r of pack.rumors || []) {
    const v = validateRumorShape(r);
    if (!v.ok) errors.push(...v.errors.map(e => `rumors[${r?.id || '?'}]: ${e}`));
  }
  for (const ev of pack.evidence || []) {
    const v = validateEvidenceShape(ev);
    if (!v.ok) errors.push(...v.errors.map(e => `evidence[${ev?.id || '?'}]: ${e}`));
  }
  for (const d of pack.dialogue || []) {
    const v = validateDialogueEntryShape(d);
    if (!v.ok) errors.push(...v.errors.map(e => `dialogue[${d?.id || '?'}]: ${e}`));
  }
  return { ok: errors.length === 0, errors };
}

export function validateAllScenarios() {
  const all = loadAllScenarios();
  const errors = [];
  for (const ep of all.episodes) {
    const r = validateEpisodeShape(ep);
    if (!r.ok) errors.push(...r.errors.map(e => `episode[${ep?.id || '?'}]: ${e}`));
  }
  for (const rp of all.resolutionPaths) {
    const r = validateResolutionPathShape(rp);
    if (!r.ok) errors.push(...r.errors.map(e => `path[${rp?.id || '?'}]: ${e}`));
  }
  const pack = validatePackShape(all);
  if (!pack.ok) errors.push(...pack.errors);
  return {
    ok: errors.length === 0,
    errors,
    counts: {
      episodes: all.episodes.length,
      resolutionPaths: all.resolutionPaths.length,
      incidents: all.incidents.length,
      rumors: all.rumors.length,
      evidence: all.evidence.length,
      dialogue: all.dialogue.length
    }
  };
}