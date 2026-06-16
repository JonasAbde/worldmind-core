/**
 * TypeScript façade for `src/simulation/state.js`.
 *
 * The runtime logic still lives in `state.js` (we are migrating
 * gradually to keep the MVP behaviour intact). This shim re-exports
 * the existing functions and gives `tsc` a single source of truth
 * for the WorldState shape.
 *
 * The shim is only used at type-check time (`tsc --noEmit`). At
 * runtime, all callers continue to import directly from `state.js`
 * via the original dynamic import path. This file is **not** consumed
 * by the runtime — it exists purely to let us type-check the world
 * builder and feed typed shapes into the rest of the codebase.
 */

import type {
  ScenarioContract,
  WorldState
} from '../contracts/types.js';

export type { WorldState, ScenarioContract } from '../contracts/types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type WorldRuntime = WorldState & {
  rng: { getState: () => number | { state: number } | null };
  advanceTick: () => void;
  addEvent: (event: Partial<WorldState['events'][number]>) => WorldState['events'][number];
  nextId: (prefix: string) => string;
  idCounters: Record<string, number>;
};
