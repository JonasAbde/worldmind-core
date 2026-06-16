/**
 * Pure render-mode helpers for 3D embodied assets (testable without Three.js).
 */

/** @param {string | null | undefined} modelUrl */
export function shouldUseGltfBuilding(modelUrl) {
  return Boolean(modelUrl);
}

/**
 * @param {string | undefined} renderMode
 * @param {string | null | undefined} modelUrl
 */
export function shouldUseGltfBody(renderMode = 'mesh3d', modelUrl) {
  return renderMode === 'mesh3d' && Boolean(modelUrl);
}

/**
 * @param {{ locations?: Array<{ modelUrl?: string | null, agents?: Array<{ modelUrl?: string | null }> }>, player?: { modelUrl?: string | null } | null }} cues
 * @returns {string[]}
 */
export function collectVisualCuesModelUrls(cues) {
  const urls = new Set();
  for (const loc of cues.locations ?? []) {
    if (loc.modelUrl) urls.add(loc.modelUrl);
    for (const agent of loc.agents ?? []) {
      if (agent.modelUrl) urls.add(agent.modelUrl);
    }
  }
  if (cues.player?.modelUrl) urls.add(cues.player.modelUrl);
  return [...urls];
}
