/**
 * WorldMind asset binding layer.
 *
 * This module does not embed binary files. It defines stable asset paths
 * and binds those paths onto runtime world entities so the web UI, future
 * 2D map, docs, and creator tools can reference visuals without guessing.
 */

export const ASSET_BASE = 'assets';

export const WORLD_ASSETS = Object.freeze({
  hero: 'assets/hero/worldmind-cover.png',
  showcase: 'assets/showcase/worldmind-v2-showcase.png',
  districtMap: 'assets/maps/new-aarhus-district-map.png',
  ui: {
    hudMemoryPermissions: 'assets/ui/hud-memory-permissions.png',
    evidenceCard: 'assets/ui/evidence-card.png',
    rumorCard: 'assets/ui/rumor-card.png',
    memoryNode: 'assets/ui/memory-node.png',
    relationshipEdge: 'assets/ui/relationship-edge.png',
    incidentAlert: 'assets/ui/incident-alert.png',
    lenoOverlay: 'assets/ui/leno-overlay.png',
    commandButton: 'assets/ui/command-button.png'
  }
});

export const LOCATION_ASSETS = Object.freeze({
  cafe: {
    scene: 'assets/locations/cafe.png',
    card: 'assets/locations/cards/cafe-card.png',
    icon: 'assets/locations/icons/cafe.svg'
  },
  market: {
    scene: 'assets/locations/market.png',
    card: 'assets/locations/cards/market-card.png',
    icon: 'assets/locations/icons/market.svg'
  },
  workshop: {
    scene: 'assets/locations/workshop.png',
    card: 'assets/locations/cards/workshop-card.png',
    icon: 'assets/locations/icons/workshop.svg'
  },
  apartment: {
    scene: 'assets/locations/apartment.png',
    card: 'assets/locations/cards/apartment-card.png',
    icon: 'assets/locations/icons/apartment.svg'
  },
  district_square: {
    scene: 'assets/locations/district-square.png',
    card: 'assets/locations/cards/district-square-card.png',
    icon: 'assets/locations/icons/district-square.svg'
  }
});

const KNOWN_AGENT_IDS = [
  'player', 'sara', 'malik', 'nadia', 'omar', 'lina', 'yasin', 'freja', 'rune', 'amina', 'elias'
];

export const CHARACTER_ASSETS = Object.freeze(Object.fromEntries(KNOWN_AGENT_IDS.map((id) => [
  id,
  {
    portrait: `assets/characters/${id}/portrait.png`,
    avatar: `assets/characters/${id}/avatar.png`,
    expressionNeutral: `assets/characters/${id}/expression-neutral.png`,
    expressionConcerned: `assets/characters/${id}/expression-concerned.png`,
    sheet: id === 'player' ? 'assets/characters/player/player-sheet.png' : 'assets/characters/npc-portrait-set.png'
  }
])));

export const MODEL_ASSETS = Object.freeze({
  locations: {
    apartment: 'assets/models/locations/apartment.glb',
    cafe: 'assets/models/locations/cafe.glb',
    market: 'assets/models/locations/market.glb',
    workshop: 'assets/models/locations/workshop.glb',
    district_square: 'assets/models/locations/district_square.glb'
  },
  characters: {
    humanoid: 'assets/models/characters/humanoid.glb'
  }
});

export const AUDIO_ASSETS = Object.freeze({
  uiClick: 'assets/audio/ui-click.wav',
  evidenceFound: 'assets/audio/evidence-found.wav',
  rumorSpread: 'assets/audio/rumor-spread.wav',
  rumorHeard: 'assets/audio/rumor-heard.wav',
  incidentAlert: 'assets/audio/incident-alert.wav',
  lenoNotification: 'assets/audio/leno-notification.wav',
  ambientDistrict: 'assets/audio/ambient-new-aarhus.mp3',
  /** Play command cues — see src/play/audio-cues.js */
  walkStart: 'assets/audio/walk-start.wav',
  consequence: 'assets/audio/consequence.wav',
  levelUp: 'assets/audio/level-up.wav',
  hotspotInspect: 'assets/audio/hotspot-inspect.wav'
});

export function getAssetRegistry() {
  return {
    version: 1,
    world: WORLD_ASSETS,
    locations: LOCATION_ASSETS,
    characters: CHARACTER_ASSETS,
    models: MODEL_ASSETS,
    audio: AUDIO_ASSETS
  };
}

export function bindAssets(world, registry = getAssetRegistry()) {
  if (!world || typeof world !== 'object') return world;
  world.assets = {
    ...(world.assets || {}),
    hero: registry.world.hero,
    showcase: registry.world.showcase,
    districtMap: registry.world.districtMap,
    ui: registry.world.ui,
    audio: registry.audio
  };

  for (const [id, loc] of Object.entries(world.locations || {})) {
    loc.assets = {
      ...(loc.assets || {}),
      ...(registry.locations[id] || {
        scene: `assets/locations/${id}.png`,
        card: `assets/locations/cards/${id}-card.png`,
        icon: `assets/locations/icons/${id}.svg`
      })
    };
  }

  for (const [id, agent] of Object.entries(world.agents || {})) {
    agent.assets = {
      ...(agent.assets || {}),
      ...(registry.characters[id] || {
        portrait: `assets/characters/${id}/portrait.png`,
        avatar: `assets/characters/${id}/avatar.png`,
        expressionNeutral: `assets/characters/${id}/expression-neutral.png`,
        expressionConcerned: `assets/characters/${id}/expression-concerned.png`,
        sheet: 'assets/characters/npc-portrait-set.png'
      })
    };
  }

  return world;
}

export function flattenAssetPaths(registry = getAssetRegistry()) {
  const paths = [];
  const visit = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      paths.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(visit);
    }
  };
  visit(registry);
  return [...new Set(paths)].sort();
}

export function validateAssetRegistry(registry = getAssetRegistry()) {
  const paths = flattenAssetPaths(registry);
  const invalid = paths.filter((p) => !p.startsWith('assets/') || /\s/.test(p));
  const required = [
    WORLD_ASSETS.hero,
    WORLD_ASSETS.showcase,
    WORLD_ASSETS.ui.hudMemoryPermissions,
    CHARACTER_ASSETS.sara.portrait,
    LOCATION_ASSETS.cafe.scene
  ];
  const missingRequired = required.filter((p) => !paths.includes(p));
  return {
    ok: invalid.length === 0 && missingRequired.length === 0,
    totalPaths: paths.length,
    invalid,
    missingRequired,
    paths
  };
}
