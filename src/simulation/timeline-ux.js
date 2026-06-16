import { buildTimelineBranchView, diffSnapshots, filterEvents } from '../persistence/timeline.js';

export function buildTimelineUxModel({ store = null, world } = {}) {
  const snapshots = store ? store.listSnapshots(world.id) : [];
  const branches = store ? buildTimelineBranchView({ branches: store.listTimelineBranches(world.id), snapshots }) : [];
  const currentSnapshotId = world.currentSnapshotId ?? snapshots.at(-1)?.id ?? null;
  const currentSnapshot = currentSnapshotId ? snapshots.find(snapshot => snapshot.id === currentSnapshotId) ?? snapshots.at(-1) ?? null : snapshots.at(-1) ?? null;
  const compareSnapshots = snapshots.length >= 2 ? snapshots.slice(-2) : [];
  const diff = compareSnapshots.length === 2 && store
    ? diffSnapshots(store.loadSnapshot(compareSnapshots[0].id), store.loadSnapshot(compareSnapshots[1].id))
    : diffSnapshots(world, world);
  return { snapshots, branches, currentSnapshot, compareSnapshots, diff };
}

export function diffWorldStates(before, after) {
  const diff = diffSnapshots(before, after);
  return {
    beforeSnapshotId: diff.beforeSnapshotId,
    afterSnapshotId: diff.afterSnapshotId,
    changedAgentLocations: diff.agentLocationChanges,
    changedRelationships: diff.relationshipChanges,
    newMemories: diff.newMemories,
    newRumors: diff.newRumors,
    economyChanges: diff.economyChanges,
    incidentStatusChanges: diff.incidentChanges,
    summary: diff.summary
  };
}

export function filterWorldEvents(events, filters = {}) {
  return filterEvents(events, {
    branchName: filters.branchName ?? null,
    branchOriginSnapshotId: filters.branchOriginSnapshotId ?? null,
    branchParentSnapshotId: filters.branchParentSnapshotId ?? null,
    tickFrom: filters.minTick ?? filters.tickFrom ?? null,
    tickTo: filters.maxTick ?? filters.tickTo ?? null,
    actorId: filters.actorId ?? null,
    incidentId: filters.incidentId ?? null,
    type: filters.type ?? null
  });
}

export function formatSnapshotList(snapshots = []) {
  return snapshots.map(snapshot => `${snapshot.id ?? '(current)'} | ${snapshot.branchName ?? 'main'} | ${snapshot.day ?? ''} ${snapshot.time ?? ''}`).join('\n');
}

export function formatBranchList(branches = []) {
  return branches.map(branch => `${branch.name} | origin=${branch.originSnapshotId ?? ''} | parent=${branch.parentSnapshotId ?? ''}`).join('\n');
}

export function formatTimelineDiff(diff) {
  return JSON.stringify(diff, null, 2);
}
