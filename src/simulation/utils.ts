/**
 * Authoritative TypeScript module — `utils.ts`.
 *
 * Last simulation JS file migrated in v0.8. Provides deterministic
 * helpers used by the canonical 7-day simulation, persistence layer
 * and validators.
 *
 * Typed `makeRng` returns an RNG with `getState` / `setState` /
 * `snapshot` so that any `WorldRuntime` can be deep-cloned and
 * restored without losing its deterministic stream.
 */

export interface RngStateSnapshot {
  seed: number;
  state: number;
}

export interface Rng {
  (): number;
  getState(): number;
  setState(nextState: number | null | undefined): number;
  snapshot(): RngStateSnapshot;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createId(prefix: string, counter: number): string {
  return `${prefix}_${String(counter).padStart(5, '0')}`;
}

export function deepClone<T>(value: T): T {
  // Cycle-safe, function-safe deep clone.
  // - Tracks seen objects to break circular references (e.g.
  //   agent.relationships[otherId] -> otherAgent.relationships[firstId]).
  // - Strips functions and undefined values so the result is always
  //   JSON-serializable.
  const seen = new WeakMap();
  function walk(v: unknown): unknown {
    if (v === null || v === undefined) return v;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return v;
    if (t === 'function' || t === 'symbol' || t === 'bigint') return undefined;
    if (v instanceof Date) return new Date(v.getTime());
    if (Array.isArray(v)) {
      if (seen.has(v)) return seen.get(v);
      const arr: unknown[] = [];
      seen.set(v, arr);
      for (const item of v) {
        const cloned = walk(item);
        if (cloned !== undefined) arr.push(cloned);
      }
      return arr;
    }
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      if (seen.has(obj)) return seen.get(obj);
      const out: Record<string, unknown> = {};
      seen.set(obj, out);
      for (const [k, val] of Object.entries(obj)) {
        const cloned = walk(val);
        if (cloned !== undefined) out[k] = cloned;
      }
      return out;
    }
    return undefined;
  }
  return walk(value) as T;
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function makeRng(seed: number = 42, initialState: number | null = null): Rng {
  let state = (initialState ?? seed) >>> 0;
  function rng(): number {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  }
  rng.getState = (): number => state >>> 0;
  rng.setState = (nextState: number | null | undefined): number => {
    state = (nextState ?? state) >>> 0;
    return state;
  };
  rng.snapshot = (): RngStateSnapshot => ({ seed: (seed >>> 0), state: (state >>> 0) });
  return rng;
}

export interface TickDayTime {
  day: number;
  time: string;
}

export function tickToDayTime(tick: number): TickDayTime {
  const ticksPerDay = 96;
  const day = Math.floor(tick / ticksPerDay) + 1;
  const tickInDay = tick % ticksPerDay;
  const totalMinutes = tickInDay * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { day, time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` };
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
