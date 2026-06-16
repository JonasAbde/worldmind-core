/**
 * Scene texture path for a district location id (content pack + fallbacks).
 */
import { getContentPack } from './content-pack-runtime.js';

const ID_ALIASES = Object.freeze({
  district_square: 'district-square'
});

export function sceneTexturePathForLocation(locationId) {
  const pack = getContentPack();
  const packLoc = pack?.locations?.find((l) => l.id === locationId);
  if (packLoc?.scene) return packLoc.scene;
  const file = ID_ALIASES[locationId] ?? locationId;
  return `assets/locations/${file}.png`;
}
