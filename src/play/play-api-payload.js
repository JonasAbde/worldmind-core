/**
 * Stable play API payload builders for play-server and external clients
 * (worldmind-site /play portal, future 3D client).
 *
 * All gameplay truth stays in play-engine; this module only shapes
 * redacted, client-safe JSON envelopes.
 */

import { summarizeWorld } from './play-engine.js';
import { buildGameplayShellModel, buildConsequenceBeat } from './game-shell-model.js';
import { buildDistrictView } from './district-view.js';
import { build3DVisualCues } from './district-3d-layout.js';

/** Bump when breaking response shapes documented in docs/PLAY_API_CONTRACT.md */
export const PLAY_API_VERSION = '1.0.0';

export function buildPlayerSnapshot(world) {
  const player = world?.agents?.player;
  return {
    money: player?.stats?.money ?? 0,
    reputation: player?.stats?.reputation ?? 0,
    energy: player?.stats?.energy ?? 0
  };
}

export function buildGameShell(world, options = {}) {
  return buildGameplayShellModel(world, {
    playerKnowledge: world?.playerKnowledge,
    leno: options.leno ?? null
  });
}

/**
 * Full boot/sync payload for GET /api/state.
 */
export function buildPlayStatePayload(world, options = {}) {
  const summary = options.summary ?? summarizeWorld(world);
  const leno = options.leno ?? null;
  return {
    ok: true,
    apiVersion: PLAY_API_VERSION,
    contract: 'docs/PLAY_API_CONTRACT.md',
    worldId: world?.id ?? null,
    currentSnapshotId: world?.currentSnapshotId || null,
    branchName: world?.branchName || 'main',
    tick: summary.tick ?? world?.tick ?? 0,
    day: summary.day ?? world?.day ?? 0,
    time: summary.time ?? world?.time ?? 'morning',
    sections: summary.sections || summary,
    playerSnapshot: buildPlayerSnapshot(world),
    playerKnowledge: world?.playerKnowledge ?? {
      evidenceIds: [],
      knownRumorIds: [],
      suspectedCauses: [],
      unresolvedQuestions: []
    },
    founder: world?.founder ?? null,
    gameShell: buildGameShell(world, { leno }),
    districtView: options.includeDistrictView === false ? undefined : buildDistrictView(world),
    visualCues: options.includeVisualCues === false ? undefined : build3DVisualCues(world, { leno }),
    redaction: {
      hiddenCause: 'never_in_api',
      agentSecrets: 'never_in_api',
      lenoSourceDefining: 'redacted_until_rumor_source_nadia_evidence'
    }
  };
}

/**
 * Sanitized command result envelope (POST /api/command → result).
 */
export function buildCommandResultPayload(world, result, options = {}) {
  if (!result || typeof result !== 'object') return result;
  const clone = { ...result };
  if ('world' in clone && world) {
    const w = world;
    clone.world = {
      id: w?.id,
      tick: w?.tick,
      day: w?.day,
      time: w?.time,
      currentSnapshotId: w?.currentSnapshotId ?? null,
      branchName: w?.branchName ?? 'main'
    };
    clone.playerSnapshot = buildPlayerSnapshot(w);
    clone.founder = w?.founder ?? null;
    clone.playerKnowledge = w?.playerKnowledge ?? null;
  }
  clone.gameShell = buildGameShell(world, { leno: result.leno });
  if (result.consequence) {
    clone.consequenceBeat = buildConsequenceBeat(result.consequence);
  }
  if (options.majorDecisionPrompt) {
    clone.majorDecisionPrompt = options.majorDecisionPrompt;
  }
  return clone;
}
