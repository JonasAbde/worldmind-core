/**
 * Shared assertions for Play API production verification (visualCues v4, walkAnimation).
 */

export function assertVisualCuesV4(visualCues) {
  const problems = [];
  if (!visualCues || visualCues.kind !== 'worldmind_3d_visual_cues') {
    problems.push('visualCues missing or wrong kind');
  }
  if (visualCues?.version !== 4) {
    problems.push(`visualCues.version expected 4, got ${visualCues?.version}`);
  }
  const nodeCount = Object.keys(visualCues?.walkGraph?.nodes ?? {}).length;
  if (nodeCount < 4) {
    problems.push(`visualCues.walkGraph.nodes expected >= 4, got ${nodeCount}`);
  }
  const edgeCount = visualCues?.walkGraph?.edges?.length ?? 0;
  if (edgeCount < 3) {
    problems.push(`visualCues.walkGraph.edges expected >= 3, got ${edgeCount}`);
  }
  if (!visualCues?.interior?.locationId) {
    problems.push('visualCues.interior.locationId missing');
  }
  if (!Array.isArray(visualCues?.interior?.hotspots)) {
    problems.push('visualCues.interior.hotspots missing');
  }
  if (!Array.isArray(visualCues?.hotspots)) {
    problems.push('visualCues.hotspots missing');
  }
  return { ok: problems.length === 0, problems };
}

/** Assert mesh3d + modelUrl when baked GLB pipeline is active (v39+). */
export function assertVisualCuesMesh3d(visualCues) {
  const problems = [];
  if (!visualCues) {
    problems.push('visualCues missing');
    return { ok: false, problems };
  }
  for (const loc of visualCues.locations ?? []) {
    if (loc.renderMode && loc.renderMode !== 'mesh3d') {
      problems.push(`location ${loc.id} renderMode expected mesh3d`);
    }
    if (loc.modelUrl && !String(loc.modelUrl).endsWith('.glb')) {
      problems.push(`location ${loc.id} modelUrl should be .glb`);
    }
  }
  const agents = (visualCues.locations ?? []).flatMap((l) => l.agents ?? []);
  for (const agent of agents) {
    if (agent.renderMode && agent.renderMode !== 'mesh3d') {
      problems.push(`agent ${agent.id} renderMode expected mesh3d`);
    }
    if (agent.modelUrl && !String(agent.modelUrl).endsWith('.glb')) {
      problems.push(`agent ${agent.id} modelUrl should be .glb`);
    }
  }
  if (visualCues.player?.renderMode && visualCues.player.renderMode !== 'mesh3d') {
    problems.push('player renderMode expected mesh3d');
  }
  if (visualCues.player?.modelUrl && !String(visualCues.player.modelUrl).endsWith('.glb')) {
    problems.push('player modelUrl should be .glb');
  }
  const withModels = (visualCues.locations ?? []).filter((l) => l.modelUrl);
  if (withModels.length > 0 && withModels.length < 4) {
    problems.push(`expected modelUrl on all district locations, got ${withModels.length}`);
  }
  return { ok: problems.length === 0, problems };
}

/** Assert footprint-aligned collision volumes on district locations (v40+). */
export function assertVisualCuesCollision(visualCues) {
  const problems = [];
  if (!visualCues) {
    problems.push('visualCues missing');
    return { ok: false, problems };
  }
  for (const loc of visualCues.locations ?? []) {
    const col = loc.collision;
    if (!col || (col.shape !== 'box' && col.shape !== 'circle')) {
      problems.push(`location ${loc.id} collision.shape expected box|circle`);
    }
    if (!Array.isArray(col?.halfExtents) || col.halfExtents.length !== 2) {
      problems.push(`location ${loc.id} collision.halfExtents expected [2]`);
    }
    if (typeof col?.radius !== 'number' || col.radius <= 0) {
      problems.push(`location ${loc.id} collision.radius expected positive number`);
    }
    if (!Array.isArray(loc.footprint) || loc.footprint.length !== 3) {
      problems.push(`location ${loc.id} footprint expected [w,h,d]`);
    }
  }
  return { ok: problems.length === 0, problems };
}

export function assertWalkAnimation(walkAnimation, expectedFrom, expectedTo) {
  const problems = [];
  if (!walkAnimation) {
    problems.push('walkAnimation missing');
    return { ok: false, problems };
  }
  if (walkAnimation.kind !== 'worldmind_walk_animation') {
    problems.push(`walkAnimation.kind expected worldmind_walk_animation, got ${walkAnimation.kind}`);
  }
  if (expectedFrom && walkAnimation.from !== expectedFrom) {
    problems.push(`walkAnimation.from expected ${expectedFrom}, got ${walkAnimation.from}`);
  }
  if (expectedTo && walkAnimation.to !== expectedTo) {
    problems.push(`walkAnimation.to expected ${expectedTo}, got ${walkAnimation.to}`);
  }
  if (!Array.isArray(walkAnimation.waypoints) || walkAnimation.waypoints.length < 2) {
    problems.push('walkAnimation.waypoints expected >= 2 points');
  }
  if (typeof walkAnimation.durationMs !== 'number' || walkAnimation.durationMs < 400) {
    problems.push('walkAnimation.durationMs expected >= 400');
  }
  return { ok: problems.length === 0, problems };
}

/** Pick a district node id different from the player's current location. */
export function pickMoveTarget(statePayload) {
  const from = statePayload?.visualCues?.playerLocationId
    ?? statePayload?.districtView?.playerLocationId
    ?? statePayload?.gameShell?.location?.id;
  const nodes = statePayload?.districtView?.nodes ?? [];
  const target = nodes.find((n) => n.id && n.id !== from);
  return { from, to: target?.id ?? null };
}
