import { ACTION_RISK_LIMIT_MVP } from '../simulation/constants.js';

const OBJECTS = [
  ['apartment_registry_terminal', 'apartment', 'Query registry', 'inspect', 1, 'online', 'registry_synced', [], 'Registry pressure and district records synchronized.'],
  ['cafe_vending_unit', 'cafe', 'Scan supplies', 'inspect', 1, 'ready', 'stock_scanned', [], 'The vendor confirms emergency stock is low.'],
  ['cafe_delivery_drone', 'cafe', 'Run diagnostics', 'inspect', 2, 'grounded', 'diagnostics_complete', ['cafe_delivery_gap'], 'Drone diagnostics expose missing shipment tags in its cargo history.'],
  ['market_holo_signpost', 'market', 'Read public routes', 'observe', 0, 'broadcasting', 'route_read', [], 'Public routes and district notices have been cached.'],
  ['workshop_data_node', 'workshop', 'Read diagnostics', 'inspect', 2, 'locked', 'diagnostics_read', [], 'Parts and maintenance diagnostics are now visible.'],
  ['square_smart_bench', 'district_square', 'Open mediation access', 'observe', 1, 'idle', 'mediation_ready', [], 'The bench opens public mediation and charging access.'],
  ['apartment_access_panel', 'apartment', 'Authenticate', 'inspect', 2, 'locked', 'authenticated', [], 'Residential access accepted the player permission token.'],
  ['apartment_smart_chair', 'apartment', 'Sync haptics', 'observe', 0, 'idle', 'haptics_synced', [], 'The chair synchronized its haptic profile.'],
  ['apartment_sensor_lamp', 'apartment', 'Calibrate sensor', 'inspect', 1, 'standby', 'calibrated', [], 'Proximity and gesture sensors calibrated successfully.'],
  ['cafe_foldable_table', 'cafe', 'Inspect service surface', 'inspect', 1, 'folded', 'service_ready', [], 'The table is ready for deliveries and service overflow.'],
  ['cafe_trash_compactor', 'cafe', 'Check capacity', 'inspect', 1, 'sealed', 'capacity_checked', [], 'Waste telemetry shows normal capacity and no hazardous alert.'],
  ['workshop_power_junction', 'workshop', 'Read power status', 'inspect', 2, 'locked', 'diagnostics_read', [], 'The junction reports stable power with one delivery-bay anomaly.'],
  ['market_autonomous_pod', 'market', 'Sync route', 'move', 1, 'idle', 'route_synced', [], 'The pod synchronized its public market route.'],
  ['market_vertical_garden', 'market', 'Check irrigation', 'observe', 0, 'growing', 'irrigation_checked', [], 'Irrigation and shelter climate readings are healthy.'],
  ['square_transit_shuttle', 'district_square', 'Check departures', 'move', 1, 'docked', 'departures_synced', [], 'The shuttle confirms its next departure toward Market Street.']
];

export const WORLD_OBJECTS = Object.freeze(Object.fromEntries(OBJECTS.map((entry) => {
  const [id, locationId, actionLabel, requiredPermission, risk, initialState, resultState, evidenceIds, resultText] = entry;
  return [id, Object.freeze({
    id,
    locationId,
    actionLabel,
    requiredPermission,
    risk,
    initialState,
    resultState,
    evidenceIds: Object.freeze(evidenceIds),
    resultText
  })];
})));

export function worldObjectDefinition(objectId) {
  return WORLD_OBJECTS[objectId] ?? null;
}

export function worldObjectState(world, objectId) {
  const definition = worldObjectDefinition(objectId);
  if (!definition) return null;
  for (let i = (world?.events?.length ?? 0) - 1; i >= 0; i -= 1) {
    const event = world.events[i];
    if (event?.type === 'world_object_interacted' && event?.payload?.objectId === objectId) {
      return event.payload.stateAfter ?? definition.initialState;
    }
  }
  return definition.initialState;
}

export function worldObjectCue(world, objectId) {
  const definition = worldObjectDefinition(objectId);
  if (!definition) return null;
  const actor = world?.agents?.player;
  const atLocation = actor?.locationId === definition.locationId;
  const hasPermission = actor?.permissions?.includes(definition.requiredPermission) === true;
  return {
    command: `use_object ${objectId}`,
    actionLabel: definition.actionLabel,
    requiredPermission: definition.requiredPermission,
    risk: definition.risk,
    state: worldObjectState(world, objectId),
    available: atLocation && hasPermission,
    blockedReason: !atLocation
      ? `Travel to ${world?.locations?.[definition.locationId]?.name ?? definition.locationId}`
      : !hasPermission
        ? `Requires ${definition.requiredPermission} permission`
        : null
  };
}

export function prepareWorldObjectInteraction(world, objectId, actorId = 'player') {
  const definition = worldObjectDefinition(objectId);
  if (!definition) throw new Error(`unknown world object: ${objectId}`);
  const actor = world?.agents?.[actorId];
  if (!actor) throw new Error(`Actor not found: ${actorId}`);
  if (actor.locationId !== definition.locationId) {
    throw new Error(`${definition.actionLabel} requires travel to ${world.locations?.[definition.locationId]?.name ?? definition.locationId}`);
  }
  if (!actor.permissions?.includes(definition.requiredPermission)) {
    throw new Error(`${actor.name} lacks permission: ${definition.requiredPermission}`);
  }
  if (definition.risk > ACTION_RISK_LIMIT_MVP) {
    throw new Error(`World object risk ${definition.risk} exceeds MVP limit ${ACTION_RISK_LIMIT_MVP}`);
  }
  return {
    definition,
    stateBefore: worldObjectState(world, objectId),
    stateAfter: definition.resultState
  };
}
