/**
 * Portrait texture for 3D district clients (billboard sprites).
 * Prefers cinematic portrait art — never character-sheet (UI mockup panels).
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
  const hasWebp = repoAssetExists(webp);
  const hasPng = repoAssetExists(png);
  if (hasWebp && hasPng) return webp;
  if (hasWebp) return webp;
  if (hasPng) return png;
  return null;
}

/**
 * @param {string} characterId
 * @param {string|null} [preferred] optional pack/runtime path
 * @returns {string} assets/characters/... path
 */
const SHEET_STEMS = new Set(['character-sheet', 'player-sheet']);

function isSheetAssetPath(relPath) {
  if (typeof relPath !== 'string') return false;
  const stem = relPath.split('/').pop()?.replace(/\.(png|webp)$/i, '') ?? '';
  return SHEET_STEMS.has(stem);
}

export function resolveCharacterFigurePath(characterId, preferred = null) {
  if (typeof preferred === 'string' && preferred.startsWith('assets/') && repoAssetExists(preferred)) {
    if (!isSheetAssetPath(preferred)) {
      const base = preferred.replace(/\.(png|webp)$/i, '');
      return pickPngOrWebp(base) ?? preferred;
    }
  }

  const stems = ['portrait', 'avatar', 'expression-neutral'];

  for (const stem of stems) {
    const picked = pickPngOrWebp(`assets/characters/${characterId}/${stem}`);
    if (picked) return picked;
  }

  return pickPngOrWebp(`assets/characters/${characterId}/avatar`)
    ?? `assets/characters/${characterId}/portrait.png`;
}
