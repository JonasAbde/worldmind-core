/**
 * State validator — runtime audit of canonical WorldState shape.
 *
 * v0.9: asserts that a state file (scenario, snapshot, runtime state)
 * has every key from the canonical `WorldState` contract in
 * `src/contracts/types.ts`. Returns { ok, errors, totalKeys, missingKeys }.
 */

const REQUIRED_STATE_KEYS = [
  'kind',
  'version',
  'id',
  'name',
  'tick',
  'day',
  'time',
  'agents',
  'locations',
  'items',
  'factions',
  'memories',
  'rumors',
  'incidents',
  'tasks',
  'events',
  'relationshipEvents',
  'playerKnowledge',
  'economy'
];

export function validateStateShape(state) {
  const errors = [];
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, errors: ['state must be an object'], totalKeys: 0, missingKeys: REQUIRED_STATE_KEYS };
  }
  const missing = REQUIRED_STATE_KEYS.filter((k) => !(k in state));
  for (const key of missing) errors.push(`state.${key} is required`);
  if (state.kind && state.kind !== 'world_state') errors.push(`state.kind must be 'world_state' (got '${state.kind}')`);
  if (state.version && state.version !== 2) errors.push(`state.version must be 2 (got ${state.version})`);
  if (typeof state.tick !== 'number' || state.tick < 0) errors.push('state.tick must be a non-negative number');
  if (typeof state.day !== 'number' || state.day < 1) errors.push('state.day must be a positive number');
  if (typeof state.time !== 'string' || !state.time) errors.push('state.time must be a non-empty string');
  if (!state.agents || typeof state.agents !== 'object') errors.push('state.agents must be an object');
  if (!state.locations || typeof state.locations !== 'object') errors.push('state.locations must be an object');
  if (!Array.isArray(state.events)) errors.push('state.events must be an array');
  if (!Array.isArray(state.relationshipEvents)) errors.push('state.relationshipEvents must be an array');
  if (!state.playerKnowledge || typeof state.playerKnowledge !== 'object') errors.push('state.playerKnowledge must be an object');
  if (!state.economy || typeof state.economy !== 'object') errors.push('state.economy must be an object');
  return {
    ok: errors.length === 0,
    errors,
    totalKeys: REQUIRED_STATE_KEYS.length,
    missingKeys: missing
  };
}
