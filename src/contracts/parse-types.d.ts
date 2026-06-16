/**
 * TypeScript declarations for the parse wrappers in `./parse.js`.
 * The runtime code is plain JavaScript; this file only exists to
 * let `tsc` validate the call sites of the parsers.
 */

import type {
  ScenarioContract,
  WorldState,
  SnapshotMetadata,
  BranchMetadata,
  ActionRequest,
  DiffContract
} from './types.js';

export declare function parseScenario(input: unknown): ScenarioContract;
export declare function parseWorldState(input: unknown): WorldState;
export declare function parseSnapshot(input: unknown): SnapshotMetadata & { state: WorldState };
export declare function parseBranch(input: unknown): BranchMetadata;
export declare function parseAction(input: unknown, world?: WorldState): ActionRequest;
export declare function parseDiff(input: unknown): DiffContract;
