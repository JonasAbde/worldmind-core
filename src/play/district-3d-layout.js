/**
 * 3D visual cues for Play API clients (Three.js / Babylon / R3F).
 * Maps district-view layout → world-space entities; gameplay stays in play-engine.
 */

import { buildDistrictView } from './district-view.js';
import { buildGameplayShellModel } from './game-shell-model.js';
import { resolveSceneTexturePath, sceneTexturePathForLocation } from './location-scene-assets.js';
import { resolveCharacterFigurePath } from './character-figure-assets.js';
import { resolveCharacterFullBodyPath } from './character-fullbody-assets.js';
import { resolveCharacterModelPath } from './character-model-assets.js';
import { resolveLocationModelPath } from './location-model-assets.js';
import { buildWalkGraphFromCues } from './walk-path.js';

const ZONE_STYLES = Object.freeze({
  residential: { color: '#4a6fa5', height: 2.2, emissive: '#1e3a5f' },
  social: { color: '#c97b3d', height: 3.2, emissive: '#78350f' },
  commerce: { color: '#14b8a6', height: 2.8, emissive: '#0f766e' },
  industrial: { color: '#6b7280', height: 2.6, emissive: '#374151' },
  civic: { color: '#4ade80', height: 2.0, emissive: '#166534' },
  unknown: { color: '#64748b', height: 2.0, emissive: '#334155' }
});

/** Map 2D district coords (0–100) to Three.js ground plane (x, y-up, z). */
export function mapDistrictToWorld(x, y, yOffset = 0) {
  return [(x - 50) * 0.38, yOffset, (y - 50) * 0.38];
}

export function build3DVisualCues(world, options = {}) {
  const view = buildDistrictView(world);
  const shell = buildGameplayShellModel(world, {
    playerKnowledge: world?.playerKnowledge,
    leno: options.leno ?? null
  });
  const playerLoc = view.playerLocationId;

  const locations = (view.nodes || []).map((node) => {
    const style = ZONE_STYLES[node.zone] || ZONE_STYLES.unknown;
    const position = mapDistrictToWorld(node.x, node.y);
    const isPlayerHere = node.id === playerLoc;
    return {
      id: node.id,
      label: node.name,
      zone: node.zone,
      position,
      mesh: 'district_building',
      renderMode: 'mesh3d',
      scale: [style.height * 0.85, style.height, style.height * 0.85],
      color: style.color,
      emissive: isPlayerHere ? '#f59e0b' : style.emissive,
      emissiveIntensity: isPlayerHere ? 0.45 : 0.12,
      command: `move ${node.id}`,
      incidentActive: (node.activeIncidents || []).length > 0,
      agents: (node.agentsHere || []).map((agent, index) => {
        const offset = (index - ((node.agentsHere.length - 1) / 2)) * 1.4;
        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          portrait: agent.asset || null,
          figureTexture: resolveCharacterFigurePath(agent.id, agent.asset || null),
          fullBodyTexture: resolveCharacterFullBodyPath(agent.id),
          modelUrl: resolveCharacterModelPath(agent.id),
          renderMode: 'mesh3d',
          idleAnimation: index % 2 === 0 ? 'bob' : 'turn',
          position: mapDistrictToWorld(node.x + offset * 2.5, node.y + 8, 0.9),
          commands: {
            talk: `talk ${agent.id}`,
            ask: `ask ${agent.id} delivery`,
            pay: `pay ${agent.id} 5`,
            leno: 'ask_leno'
          }
        };
      })
    };
  });

  const playerNode = locations.find((l) => l.id === playerLoc);
  const hotspotCount = shell.location?.hotspots?.length ?? 0;
  const hotspots = (shell.location?.hotspots ?? []).map((hotspot, index) => {
    const baseX = playerNode?.position[0] ?? 0;
    const baseZ = playerNode?.position[2] ?? 0;
    const angle = hotspotCount <= 1
      ? 0
      : -Math.PI / 3 + (index / (hotspotCount - 1)) * (Math.PI * 2 / 3);
    const radius = 2.8;
    return {
      id: hotspot.id,
      label: hotspot.label,
      command: hotspot.command,
      preview: hotspot.preview ?? hotspot.description ?? null,
      description: hotspot.description ?? hotspot.preview ?? null,
      risk: hotspot.risk ?? 1,
      icon: hotspot.icon ?? null,
      position: [
        baseX + Math.sin(angle) * radius,
        0.75,
        baseZ + Math.cos(angle) * radius
      ]
    };
  });

  const nodeById = Object.fromEntries((view.nodes || []).map((n) => [n.id, n]));
  for (const loc of locations) {
    const node = nodeById[loc.id];
    const packScene = sceneTexturePathForLocation(loc.id);
    const nodeAsset = node?.asset;
    const rawScene = typeof nodeAsset === 'string' && nodeAsset.startsWith('assets/')
      ? nodeAsset
      : packScene;
    loc.sceneTexture = resolveSceneTexturePath(rawScene);
    loc.modelUrl = resolveLocationModelPath(loc.id);
    loc.isPlayerHere = loc.id === playerLoc;
    loc.walkAnchor = loc.position;
    loc.interiorCamera = {
      eye: [loc.position[0], 1.65, loc.position[2] + 4.5],
      target: [loc.position[0], 1.4, loc.position[2]]
    };
  }

  const cues = {
    kind: 'worldmind_3d_visual_cues',
    version: 4,
    playerLocationId: playerLoc,
    interior: playerLoc
      ? {
          locationId: playerLoc,
          label: shell.location?.name ?? playerLoc,
          sceneTexture: sceneTexturePathForLocation(playerLoc),
          hotspots: (shell.location?.hotspots ?? []).map((h) => ({
            id: h.id,
            label: h.label,
            command: h.command,
            risk: h.risk ?? 1,
            preview: h.preview ?? h.description ?? null,
            description: h.description ?? h.preview ?? null
          }))
        }
      : null,
    player: playerNode
      ? {
          position: [playerNode.position[0], 0.1, playerNode.position[2]],
          locationId: playerLoc,
          figureTexture: resolveCharacterFigurePath('player'),
          fullBodyTexture: resolveCharacterFullBodyPath('player'),
          modelUrl: resolveCharacterModelPath('player'),
          renderMode: 'mesh3d'
        }
      : null,
    camera: {
      target: playerNode?.position ?? [0, 1.5, 0],
      distance: 16,
      minDistance: 4,
      maxDistance: 32,
      polarAngle: 0.55,
      walkEye: playerNode?.interiorCamera?.eye ?? [0, 1.65, 4.5],
      walkTarget: playerNode?.interiorCamera?.target ?? [0, 1.4, 0]
    },
    environment: {
      fogColor: '#0a0e14',
      fogNear: 18,
      fogFar: 42,
      groundColor: '#0d1117',
      gridColor: '#1f2937',
      ambientIntensity: 0.55,
      sunIntensity: 1.1
    },
    locations,
    hotspots,
    edges: (view.edges || []).map((edge) => {
      const from = locations.find((l) => l.id === edge.from);
      const to = locations.find((l) => l.id === edge.to);
      if (!from || !to) return null;
      return { from: edge.from, to: edge.to, fromPosition: from.position, toPosition: to.position };
    }).filter(Boolean)
  };
  cues.walkGraph = buildWalkGraphFromCues(cues);
  return cues;
}

export function validate3DVisualCues(cues) {
  const errors = [];
  if (cues?.kind !== 'worldmind_3d_visual_cues') errors.push('kind must be worldmind_3d_visual_cues');
  if (!Array.isArray(cues?.locations) || cues.locations.length < 4) {
    errors.push('visualCues must include at least 4 locations');
  }
  for (const loc of cues?.locations || []) {
    if (!Array.isArray(loc.position) || loc.position.length !== 3) {
      errors.push(`location ${loc.id || '?'} missing position[3]`);
    }
  }
  return { ok: errors.length === 0, errors };
}
