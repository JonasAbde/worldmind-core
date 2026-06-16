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
import { ACTION_RISK_LIMIT_MVP, RISK, ACTIONS, PERMISSIONS } from '../simulation/constants.js';

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
 * Returns { ok, errors, totalActions, maxRisk, disabledGated,
 *           permissionAudit? }.
 *
 * v0.9: when `options.strict` is true, the validator additionally
 * audits the permission-to-action mapping. It reads the `permission:`
 * field next to each `risk:` declaration and asserts:
 *   - permission is a non-empty string
 *   - permission is one of PERMISSIONS.*
 *   - the canonical ACTIONS.X is mapped to a real actionId
 */
export function validateActionRisks(options = {}) {
  const source = fs.readFileSync(actionsPath, 'utf8');
  const registry = readActionRegistry(source);
  const errors = [];
  let maxRisk = 0;
  let disabledGated = 0;
  const knownPermissions = new Set(Object.values(PERMISSIONS));
  const permissionAudit = [];

  // v0.9 strict mode: parse the source one more time to extract the
  // permission value alongside the action id and risk.
  if (options.strict) {
    const strictRe = /\[ACTIONS\.([A-Z_]+)\]:\s*\{\s*permission:\s*PERMISSIONS\.([A-Z_]+),\s*risk:\s*RISK\.([A-Z_]+)/g;
    const keyToValue = Object.fromEntries(Object.entries(ACTIONS));
    let m;
    while ((m = strictRe.exec(source)) !== null) {
      const actionKey = m[1];
      const permissionKey = m[2];
      const riskName = m[3];
      const actionId = keyToValue[actionKey];
      const permission = PERMISSIONS[permissionKey];
      const risk = RISK[riskName];
      if (!actionId) {
        errors.push(`Registry entry uses unknown action key: ${actionKey}`);
        continue;
      }
      if (!permission) {
        errors.push(`Action ${actionId} uses unknown permission key: ${permissionKey}`);
        continue;
      }
      if (typeof risk !== 'number') {
        errors.push(`Action ${actionId} uses unknown risk key: ${riskName}`);
        continue;
      }
      if (!knownPermissions.has(permission)) {
        errors.push(`Action ${actionId} has permission '${permission}' not in PERMISSIONS enum`);
      }
      permissionAudit.push({ actionId, actionKey, permission, permissionKey, risk });
    }
  }

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
    disabledGated,
    ...(options.strict ? { permissionAudit } : {})
  };
}
