/**
 * TypeScript façade for `src/simulation/sim.js`.
 *
 * Type-check only at this stage; runtime imports still go through
 * the original `sim.js` ESM module.
 */

import type { WorldState } from '../contracts/types.js';
import type { WorldRuntime } from './state.js';

export type { WorldRuntime, WorldState } from './state.js';

export interface WorldEvaluation {
  agentsActive: boolean;
  locationChanges: number;
  memoryCount: number;
  relationshipChanges: number;
  rumorSpreadCount: number;
  economyChanges: number;
  incidentDetected: boolean;
  possibleQuestResolutions: number;
  agentChangedBehavior: boolean;
  passed: boolean;
}
