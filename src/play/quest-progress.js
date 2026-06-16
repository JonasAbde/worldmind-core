/**
 * Quest resolution path tracking from content pack → resolveIncident.
 */

import { getContentPack } from './content-pack-runtime.js';
import { resolveIncident } from '../simulation/incidents.ts';

export function normalizeQuestCommand(text) {
  return String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function stepMatchesStep(step, commandText) {
  const stepNorm = normalizeQuestCommand(step);
  const cmdNorm = normalizeQuestCommand(commandText);
  if (!stepNorm || !cmdNorm) return false;
  if (cmdNorm === stepNorm) return true;
  if (cmdNorm.startsWith(`${stepNorm} `)) return true;
  if (stepNorm === 'trace_rumor' && cmdNorm.startsWith('trace_rumor')) return true;
  if (stepNorm === 'counter_rumor' && cmdNorm.startsWith('counter_rumor')) return true;
  return false;
}

export function ensureQuestProgress(world) {
  const pack = getContentPack();
  const questId = pack?.quests?.[0]?.id ?? 'quest_missing_delivery';
  if (!world.questProgress) {
    world.questProgress = {
      questId,
      completedSteps: [],
      resolvedPathId: null
    };
  }
  return world.questProgress;
}

function incidentOpen(world) {
  const incident = world.incidents?.missing_delivery
    ?? Object.values(world.incidents ?? {}).find((i) => i?.id === 'missing_delivery');
  return incident && incident.status !== 'resolved';
}

function applyPathReward(world, reward = {}) {
  const player = world.agents?.player?.stats;
  if (!player) return;
  if (reward.xp) player.xp = (player.xp ?? 0) + reward.xp;
  if (reward.districtInfluence) {
    world.districtInfluence = (world.districtInfluence ?? 0) + reward.districtInfluence;
  }
}

/**
 * Record a successful player command against pack quest steps.
 * Returns { matched, step, pathCompleted }.
 */
export function recordQuestStep(world, commandText) {
  const pack = getContentPack();
  const quest = pack?.quests?.find((q) => q.incidentId === 'missing_delivery') ?? pack?.quests?.[0];
  if (!quest || !incidentOpen(world)) return { matched: false };

  const progress = ensureQuestProgress(world);
  if (progress.resolvedPathId) return { matched: false, alreadyResolved: true };

  let matchedStep = null;
  for (const path of quest.resolutionPaths ?? []) {
    for (const step of path.steps ?? []) {
      const key = normalizeQuestCommand(step);
      if (progress.completedSteps.includes(key)) continue;
      if (stepMatchesStep(step, commandText)) {
        progress.completedSteps.push(key);
        matchedStep = step;
        break;
      }
    }
    if (matchedStep) break;
  }

  if (!matchedStep) return { matched: false };

  for (const path of quest.resolutionPaths ?? []) {
    const steps = path.steps ?? [];
    const allDone = steps.every((s) => progress.completedSteps.includes(normalizeQuestCommand(s)));
    if (!allDone) continue;

    resolveIncident(world, quest.incidentId, path.id, 'player');
    progress.resolvedPathId = path.id;
    applyPathReward(world, path.reward);
    if (world.founder && (path.id === 'founder_negotiation' || world.incidents?.missing_delivery?.status === 'resolved')) {
      world.founder.unlocked = true;
    }
    return {
      matched: true,
      step: matchedStep,
      pathCompleted: {
        id: path.id,
        label: path.label,
        reward: path.reward ?? null
      }
    };
  }

  return { matched: true, step: matchedStep, pathCompleted: null };
}

export function buildQuestProgressView(world) {
  const pack = getContentPack();
  const quest = pack?.quests?.find((q) => q.incidentId === 'missing_delivery') ?? pack?.quests?.[0];
  const progress = ensureQuestProgress(world);
  const incident = world.incidents?.missing_delivery
    ?? Object.values(world.incidents ?? {}).find((i) => i?.id === 'missing_delivery');

  const paths = (quest?.resolutionPaths ?? []).map((path) => {
    const steps = (path.steps ?? []).map((step) => {
      const key = normalizeQuestCommand(step);
      return {
        step,
        done: progress.completedSteps.includes(key)
      };
    });
    const doneCount = steps.filter((s) => s.done).length;
    return {
      id: path.id,
      label: path.label,
      steps,
      progress: steps.length ? Math.round((doneCount / steps.length) * 100) : 0,
      complete: steps.length > 0 && doneCount === steps.length
    };
  });

  return {
    questId: quest?.id ?? progress.questId,
    title: quest?.title ?? 'The Missing Delivery',
    objective: quest?.objective ?? '',
    incidentStatus: incident?.status ?? 'unknown',
    resolvedPathId: progress.resolvedPathId,
    paths
  };
}
