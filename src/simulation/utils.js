export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createId(prefix, counter) {
  return `${prefix}_${String(counter).padStart(5, '0')}`;
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function unique(values) {
  return [...new Set(values)];
}

export function makeRng(seed = 42, initialState = null) {
  let state = (initialState ?? seed) >>> 0;
  function rng() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  }
  rng.getState = () => state >>> 0;
  rng.setState = nextState => {
    state = (nextState ?? state) >>> 0;
    return state;
  };
  rng.snapshot = () => ({ seed: seed >>> 0, state: state >>> 0 });
  return rng;
}

export function tickToDayTime(tick) {
  const ticksPerDay = 96;
  const day = Math.floor(tick / ticksPerDay) + 1;
  const tickInDay = tick % ticksPerDay;
  const totalMinutes = tickInDay * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { day, time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` };
}

export function average(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
