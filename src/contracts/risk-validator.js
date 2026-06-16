/**
 * Risk validator — runtime audit of all ActionSpec risk levels.
 *
 * v0.8: ensures that no MVP-canonical action exceeds
 * ACTION_RISK_LIMIT_MVP. Risk 4/5 actions are NOT permitted in MVP
 * and would only ever exist as disabled/gated stubs. The validator
 * audits the actions.ts action registry by reading the source file
 * and parsing the `risk: RISK.X` declarations per case.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_RISK_LIMIT_MVP, RISK, ACTIONS } from '../simulation/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const actionsPath = path.resolve(__dirname, '../simulation/actions.ts');

/**
 * Parse the actions.ts source to extract a `Record<actionId, riskLevel>`.
 * Each entry is declared in a registry block as
 *   [ACTIONS.X]: { permission: PERMISSIONS.Y, risk: RISK.N }
 *
 * ACTIONS.X is an enum key — its runtime value is a lowercase string
 * (e.g. ACTIONS.MOVE_TO_LOCATION === 'move_to_location'). The actual
 * action id is the runtime value, not the enum key. We resolve it by
 * looking up the enum key in the ACTIONS constant map.
 */
export function readActionRegistry(source) {
  const actionKeyToValue = {};
  for (const [key, value] of Object.entries(ACTIONS)) {
    actionKeyToValue[key] = value;
  }
  const registry = {};
  const lineRe = /\[ACTIONS\.([A-Z_]+)\]:\s*\{[^}]*risk:\s*RISK\.([A-Z_]+)/g;
  let m;
  while ((m = lineRe.exec(source)) !== null) {
    const actionKey = m[1];
    const riskName = m[2];
    const actionId = actionKeyToValue[actionKey];
    const riskValue = RISK[riskName];
    if (actionId && typeof riskValue === 'number') {
      registry[actionId] = riskValue;
    }
  }
  return registry;
}

/**
 * Validate the action registry against the MVP risk limit.
 * Returns { ok, errors, totalActions, maxRisk, disabledGated }.
 */
export function validateActionRisks() {
  const source = fs.readFileSync(actionsPath, 'utf8');
  const registry = readActionRegistry(source);
  const errors = [];
  let maxRisk = 0;
  let disabledGated = 0;
  for (const [actionName, risk] of Object.entries(registry)) {
    if (risk > maxRisk) maxRisk = risk;
    if (risk > ACTION_RISK_LIMIT_MVP) {
      // Risk 4/5 actions in MVP would be a regression. They may only
      // exist as disabled/gated stubs (not in the runtime registry).
      errors.push(`Action ${actionName} has risk ${risk} which exceeds MVP limit ${ACTION_RISK_LIMIT_MVP}`);
      disabledGated += 1;
    }
  }
  // Spot-check: every canonical ACTIONS constant from constants.js
  // should appear in the registry. A small set of internal/reflect
  // actions (accept_task, complete_task, create_memory, etc.) are
  // intentionally not in the runtime registry because they are
  // helpers, not player-facing actions. We allow that.
  const INTERNAL_ACTIONS = new Set([
    'accept_task',
    'complete_task',
    'create_memory',
    'reflect_on_event',
    'leno_summarize',
    'leno_suggest_actions'
  ]);
  const missing = Object.values(ACTIONS)
    .filter((id) => typeof id === 'string')
    .filter((id) => !INTERNAL_ACTIONS.has(id))
    .filter((id) => !Object.keys(registry).includes(id));
  if (missing.length > 0) {
    errors.push(`Canonical actions missing from registry: ${missing.join(', ')}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    totalActions: Object.keys(registry).length,
    maxRisk,
    disabledGated
  };
}
