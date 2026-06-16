/**
 * glTF / GLB character models for embodied 3D agents.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function repoAssetExists(relPath) {
  if (typeof relPath !== 'string' || !relPath.startsWith('assets/')) return false;
  return existsSync(join(REPO_ROOT, ...relPath.split('/')));
}

/**
 * @param {string} characterId
 * @returns {string|null}
 */
export function resolveCharacterModelPath(characterId) {
  const perId = `assets/models/characters/${characterId}.glb`;
  if (repoAssetExists(perId)) return perId;
  const shared = 'assets/models/characters/humanoid.glb';
  if (repoAssetExists(shared)) return shared;
  return null;
}
