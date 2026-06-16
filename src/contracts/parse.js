/**
 * Parse wrappers — Zod-lite style runtime validators that throw on
 * invalid input. Each parser delegates to the existing validator
 * and returns a typed payload. The result is the canonical entry
 * point for CLI tools and any future strict-mode code.
 *
 * Pure JavaScript at runtime. Type information lives in
 * `./parse-types.ts` so the file can be required by Node ESM
 * without a TypeScript build step.
 */

import {
  validateScenario,
  validateWorldState,
  validateSnapshot,
  validateBranch,
  validateActionRequest,
  validateDiff
} from './validators.js';

function throwIfInvalid(label, validation) {
  if (!validation.valid) {
    const error = new Error(`Invalid ${label}: ${validation.errors.join('; ')}`);
    error.validationErrors = validation.errors;
    throw error;
  }
}

export function parseScenario(input) {
  const validation = validateScenario(input);
  throwIfInvalid('scenario', validation);
  return input;
}

export function parseWorldState(input) {
  const validation = validateWorldState(input);
  throwIfInvalid('world_state', validation);
  return input;
}

export function parseSnapshot(input) {
  const validation = validateSnapshot(input);
  throwIfInvalid('snapshot', validation);
  return input;
}

export function parseBranch(input) {
  const validation = validateBranch(input);
  throwIfInvalid('branch', validation);
  return input;
}

export function parseAction(input, world) {
  const validation = validateActionRequest(input, world);
  throwIfInvalid('action', validation);
  return input;
}

export function parseDiff(input) {
  const validation = validateDiff(input);
  throwIfInvalid('diff', validation);
  return input;
}
