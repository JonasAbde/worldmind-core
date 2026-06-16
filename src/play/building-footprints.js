/**
 * District building footprints + collision metadata for 3D play clients.
 * Single source of truth — mirrored in worldmind-site building-presets.ts.
 */

/** @typedef {'residential'|'cafe'|'market'|'industrial'|'civic'} BuildingStyle */

/**
 * @typedef {Object} BuildingPreset
 * @property {[number, number, number]} footprint [width, height, depth] in world units
 * @property {BuildingStyle} style
 * @property {string} [zone]
 */

/** @type {Record<string, BuildingPreset>} */
export const BUILDING_PRESETS = Object.freeze({
  apartment: { footprint: [3.2, 4.8, 2.6], style: 'residential', zone: 'residential' },
  cafe: { footprint: [3.6, 2.4, 3.0], style: 'cafe', zone: 'social' },
  market: { footprint: [4.2, 2.2, 3.4], style: 'market', zone: 'commerce' },
  workshop: { footprint: [3.8, 3.2, 3.2], style: 'industrial', zone: 'industrial' },
  district_square: { footprint: [4.5, 1.6, 4.5], style: 'civic', zone: 'civic' },
  default: { footprint: [3, 2.8, 2.8], style: 'residential', zone: 'unknown' }
});

/** Extra margin so players slide along building edges, not mesh faces. */
export const COLLISION_PADDING = 0.35;

/** Softer core when the player is anchored at this location (can walk out). */
export const CURRENT_LOCATION_COLLISION_RADIUS = 0.85;

/**
 * @param {string} locationId
 * @param {string} [zone]
 * @returns {BuildingPreset}
 */
export function presetForLocation(locationId, zone) {
  if (BUILDING_PRESETS[locationId]) return BUILDING_PRESETS[locationId];
  if (zone === 'commerce') return BUILDING_PRESETS.market;
  if (zone === 'industrial') return BUILDING_PRESETS.workshop;
  if (zone === 'social') return BUILDING_PRESETS.cafe;
  if (zone === 'civic') return BUILDING_PRESETS.district_square;
  if (zone === 'residential') return BUILDING_PRESETS.apartment;
  return BUILDING_PRESETS.default;
}

/**
 * Collision volume aligned to baked / procedural building footprints.
 *
 * @param {string} locationId
 * @param {string} [zone]
 * @returns {{
 *   shape: 'box'|'circle',
 *   footprint: [number, number],
 *   halfExtents: [number, number],
 *   radius: number,
 *   currentLocationRadius: number
 * }}
 */
export function buildLocationCollision(locationId, zone) {
  const preset = presetForLocation(locationId, zone);
  const [w, , d] = preset.footprint;

  if (preset.style === 'civic') {
    const radius = w / 2 + COLLISION_PADDING;
    return {
      shape: 'circle',
      footprint: [w, d],
      halfExtents: [radius, radius],
      radius,
      currentLocationRadius: CURRENT_LOCATION_COLLISION_RADIUS
    };
  }

  const halfWidth = w / 2 + COLLISION_PADDING;
  const halfDepth = d / 2 + COLLISION_PADDING;
  return {
    shape: 'box',
    footprint: [w, d],
    halfExtents: [halfWidth, halfDepth],
    radius: Math.hypot(halfWidth, halfDepth),
    currentLocationRadius: CURRENT_LOCATION_COLLISION_RADIUS
  };
}
