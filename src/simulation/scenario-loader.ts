/**
 * Authoritative TypeScript module — `scenario-loader.ts`.
 *
 * The body of the original `scenario-loader.js` has been promoted
 * here. The sibling `scenario-loader.js` is now a thin re-export
 * shim that exists purely for callers that have not yet been
 * migrated to the TypeScript import path.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { scenarioToWorldState, validateScenarioSchema } from './state.ts';
import type { ScenarioContract, WorldState } from '../contracts/types.ts';

export type { ScenarioContract, WorldState } from '../contracts/types.ts';
export { validateScenarioSchema, scenarioToWorldState } from './state.ts';

export function loadScenarioFile(filePath: string): ScenarioContract {
  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const validation = validateScenarioSchema(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid scenario file ${resolvedPath}: ${validation.errors.join('; ')}`);
  }
  return parsed as ScenarioContract;
}

export function loadScenarioWorldState(filePath: string): WorldState {
  return scenarioToWorldState(loadScenarioFile(filePath));
}

export function buildWorldFromScenario(scenario: ScenarioContract): WorldState {
  return scenarioToWorldState(scenario);
}
