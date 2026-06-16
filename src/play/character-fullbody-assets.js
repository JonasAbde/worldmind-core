/**
 * Full-body sprite path for 3D embodied characters (billboard back + face portrait).
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function repoAssetExists(relPath) {
  if (typeof relPath !== 'string' || !relPath.startsWith('assets/')) return false;
  return existsSync(join(REPO_ROOT, ...relPath.split('/')));
}

function pickPngOrWebp(basePath) {
  const webp = `${basePath}.webp`;
  const png = `${basePath}.png`;
  if (repoAssetExists(webp) && repoAssetExists(png)) return webp;
  if (repoAssetExists(webp)) return webp;
  if (repoAssetExists(png)) return png;
  return null;
}

/**
 * @param {string} characterId
 * @returns {string|null}
 */
export function resolveCharacterFullBodyPath(characterId) {
  const picked = pickPngOrWebp(`assets/characters/${characterId}/fullbody`);
  if (picked) return picked;
  return pickPngOrWebp(`assets/characters/${characterId}/portrait`);
}
