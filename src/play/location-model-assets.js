/**
 * glTF / GLB district building models for 3D play clients.
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
 * @param {string} locationId
 * @returns {string|null}
 */
export function resolveLocationModelPath(locationId) {
  const glb = `assets/models/locations/${locationId}.glb`;
  if (repoAssetExists(glb)) return glb;
  const gltf = `assets/models/locations/${locationId}.gltf`;
  if (repoAssetExists(gltf)) return gltf;
  return null;
}
