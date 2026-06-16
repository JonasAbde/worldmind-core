/**
 * WorldMind progression loop.
 *
 * Adds game-feel without compromising the simulation-first architecture:
 * commands still flow through play-engine/action validation, while this
 * module only derives XP, levels, trust, unlocks, and district influence
 * from validated command results.
 */

export const LEVELS = Object.freeze([
  { level: 1, minXp: 0, title: 'Observer' },
  { level: 2, minXp: 50, title: 'Street Listener' },
  { level: 3, minXp: 125, title: 'Rumor Analyst' },
  { level: 4, minXp: 250, title: 'District Mediator' },
  { level: 5, minXp: 425, title: 'World Operator' },
  { level: 6, minXp: 650, title: 'Leno Architect' },
  { level: 7, minXp: 950, title: 'Simulation Founder' }
]);

export const COMMAND_XP = Object.freeze({
  look: 1,
  status: 1,
  move: 3,
  inspect: 8,
  dialogue: 10,
  rumors: 14,
  transaction: 12,
  leno: 6,
  persistence: 3,
  error: 0,
  quit: 0
});

export function createInitialProgression() {
  return {
    version: 1,
    xp: 0,
    level: 1,
    title: 'Observer',
    skillPoints: 0,
    districtInfluence: 0,
    lenoTrust: 10,
    unlockedSkills: ['observe', 'talk_basic', 'inspect_basic'],
    badges: [],
    actionHistory: []
  };
}

export function getLevelForXp(xp) {
  const safeXp = Math.max(0, Number(xp || 0));
  let current = LEVELS[0];
  for (const candidate of LEVELS) {
    if (safeXp >= candidate.minXp) current = candidate;
  }
  return current;
}

function getUnlocksForResult(result) {
  const unlocks = [];
  if (result?.kind === 'rumors') unlocks.push('rumor_trace_basic');
  if (result?.kind === 'dialogue') unlocks.push('social_followup');
  if (result?.kind === 'leno') unlocks.push('leno_briefing');
  if (result?.consequence?.incident?.resolutionState) unlocks.push('incident_resolution_read');
  return unlocks;
}

function getBadgesForResult(result) {
  const badges = [];
  if (result?.kind === 'rumors' && result?.ok) badges.push('rumor-work');
  if (result?.kind === 'transaction' && result?.ok) badges.push('district-investor');
  if (result?.consequence?.incident?.status === 'resolved') badges.push('incident-resolver');
  return badges;
}

export function awardProgression(progression, result, commandText = '') {
  const state = progression || createInitialProgression();
  const beforeLevel = state.level;
  const kind = result?.ok ? result.kind : 'error';
  const baseXp = COMMAND_XP[kind] ?? 2;
  const evidenceBonus = result?.dialogue?.evidenceIds?.length ? result.dialogue.evidenceIds.length * 5 : 0;
  const consequenceBonus = result?.consequence?.newMemories > 0 ? 4 : 0;
  const xpGained = baseXp + evidenceBonus + consequenceBonus;

  state.xp += xpGained;
  const level = getLevelForXp(state.xp);
  state.level = level.level;
  state.title = level.title;

  if (state.level > beforeLevel) {
    state.skillPoints += state.level - beforeLevel;
  }

  if (result?.ok && ['dialogue', 'rumors', 'transaction'].includes(kind)) {
    state.districtInfluence += kind === 'transaction' ? 3 : 2;
  }
  if (result?.ok && kind === 'leno') {
    state.lenoTrust += 1;
  }

  for (const unlock of getUnlocksForResult(result)) {
    if (!state.unlockedSkills.includes(unlock)) state.unlockedSkills.push(unlock);
  }
  for (const badge of getBadgesForResult(result)) {
    if (!state.badges.includes(badge)) state.badges.push(badge);
  }

  state.actionHistory.push({
    command: commandText || result?.command || result?.kind || 'unknown',
    kind,
    ok: Boolean(result?.ok),
    xpGained,
    totalXp: state.xp,
    level: state.level
  });
  state.actionHistory = state.actionHistory.slice(-50);

  return {
    progression: state,
    delta: {
      xpGained,
      levelBefore: beforeLevel,
      levelAfter: state.level,
      leveledUp: state.level > beforeLevel,
      unlocks: getUnlocksForResult(result),
      badges: getBadgesForResult(result)
    }
  };
}

export function summarizeProgression(progression) {
  const state = progression || createInitialProgression();
  const current = getLevelForXp(state.xp);
  const next = LEVELS.find((l) => l.minXp > state.xp) || null;
  return {
    level: current.level,
    title: current.title,
    xp: state.xp,
    nextLevelAt: next?.minXp ?? null,
    xpToNext: next ? next.minXp - state.xp : 0,
    skillPoints: state.skillPoints,
    districtInfluence: state.districtInfluence,
    lenoTrust: state.lenoTrust,
    unlockedSkills: state.unlockedSkills,
    badges: state.badges
  };
}

export function validateProgression(progression) {
  const state = progression || createInitialProgression();
  const errors = [];
  if (!Number.isFinite(state.xp) || state.xp < 0) errors.push('xp must be a non-negative number');
  if (!Number.isInteger(state.level) || state.level < 1) errors.push('level must be a positive integer');
  if (!Array.isArray(state.unlockedSkills)) errors.push('unlockedSkills must be an array');
  if (!Array.isArray(state.badges)) errors.push('badges must be an array');
  if (!Array.isArray(state.actionHistory)) errors.push('actionHistory must be an array');
  return { ok: errors.length === 0, errors };
}
