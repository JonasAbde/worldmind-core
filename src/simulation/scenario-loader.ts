/**
 * TypeScript façade for `src/simulation/scenario-loader.js`.
 *
 * Type-check only at this stage; runtime imports still go through
 * the original `scenario-loader.js` ESM module.
 */

import type { ScenarioContract, WorldState } from '../contracts/types.js';

export type { ScenarioContract, WorldState } from '../contracts/types.js';
