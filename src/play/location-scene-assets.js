/**
 * Scene texture path for a district location id (content pack + fallbacks).
 * Prefers existing assets on disk; when both png and webp exist, prefers webp.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getContentPack } from './content-pack-runtime.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const ID_ALIASES = Object.freeze({
  district_square: 'district-square'
});

/** Runtime scene overrides — pack HUD mockups replaced by playable diorama backdrops. */
const SCENE_OVERRIDES = Object.freeze({
  apartment: 'assets/locations/apartment-interior.png'
});

function repoAssetExists(relPath) {
  if (typeof relPath !== 'string' || !relPath.startsWith('assets/')) return false;
  return existsSync(join(REPO_ROOT, ...relPath.split('/')));
}

/** Resolve assets/locations scene path to an on-disk png or webp (webp when both exist). */
export function resolveSceneTexturePath(preferredPath) {
  if (typeof preferredPath !== 'string' || !preferredPath.startsWith('assets/locations/')) {
    return preferredPath;
  }
  const base = preferredPath.replace(/\.(png|webp)$/i, '');
  const webp = `${base}.webp`;
  const png = `${base}.png`;
  const hasWebp = repoAssetExists(webp);
  const hasPng = repoAssetExists(png);
  if (hasWebp && hasPng) return webp;
  if (hasWebp) return webp;
  if (hasPng) return png;
  return preferredPath;
}

export function sceneTexturePathForLocation(locationId) {
  const override = SCENE_OVERRIDES[locationId];
  if (override) {
    const resolved = resolveSceneTexturePath(override);
    const base = resolved.replace(/\.(png|webp)$/i, '');
    if (repoAssetExists(`${base}.webp`) || repoAssetExists(`${base}.png`)) {
      return resolved;
    }
  }
  const pack = getContentPack();
  const packLoc = pack?.locations?.find((l) => l.id === locationId);
  const preferred = packLoc?.scene
    ?? `assets/locations/${ID_ALIASES[locationId] ?? locationId}.png`;
  return resolveSceneTexturePath(preferred);
}
