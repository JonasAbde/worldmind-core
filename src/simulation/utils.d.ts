/**
 * TypeScript declarations for `src/simulation/utils.js`.
 */

export function clamp(value: number, min: number, max: number): number;
export function createId(prefix: string, counter: number): string;
export function deepClone<T>(value: T): T;
export function unique<T>(values: T[]): T[];
export function makeRng(seed?: number, initialState?: number | null): {
  (): number;
  getState(): number;
  setState(nextState: number | null | undefined): number;
  snapshot(): { seed: number; state: number };
};
export function tickToDayTime(tick: number): { day: number; time: string };
export function average(values: number[]): number;
