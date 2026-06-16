/**
 * TypeScript façade for `src/simulation/world.js`.
 *
 * Type-check only at this stage; runtime imports still go through
 * the original `world.js` ESM module.
 */

import type { WorldState } from '../contracts/types.js';
import type { WorldRuntime } from './state.js';

export type { WorldRuntime } from './state.js';
export type { WorldState } from '../contracts/types.js';
