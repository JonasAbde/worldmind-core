import fs from 'node:fs';
import path from 'node:path';
import { scenarioToWorldState, validateScenarioSchema } from './state.js';

export { validateScenarioSchema } from './state.js';

export function loadScenarioFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw);
  const validation = validateScenarioSchema(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid scenario file ${resolvedPath}: ${validation.errors.join('; ')}`);
  }
  return parsed;
}

export function loadScenarioWorldState(filePath) {
  return scenarioToWorldState(loadScenarioFile(filePath));
}

export function buildWorldFromScenario(scenario) {
  return scenarioToWorldState(scenario);
}
