import { createId, makeRng, tickToDayTime } from './utils.js';
import { createInitialAgents, createInitialFactions, createInitialItems, createInitialLocations, createInitialRelationships } from './seed.js';

export function createWorld({ seed = 42 } = {}) {
  const counters = {};
  const rng = makeRng(seed);
  const agents = createInitialRelationships(createInitialAgents());
  const world = {
    id: 'new_aarhus_district_01',
    name: 'New Aarhus District 01',
    tick: 0,
    day: 1,
    time: '00:00',
    rng,
    agents,
    locations: createInitialLocations(),
    items: createInitialItems(),
    factions: createInitialFactions(),
    memories: {},
    rumors: {},
    incidents: {},
    tasks: {},
    events: [],
    relationshipEvents: [],
    playerKnowledge: { evidenceIds: [], knownRumorIds: [], knownIncidentIds: [], knownAgentIds: ['sara', 'malik', 'rune', 'amina', 'elias'] },
    economy: { foodPriceIndex: 1.0, foodScarcity: 0, laborDemand: 0.2, trustPressure: 0 },
    nextId(prefix) {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return createId(prefix, counters[prefix]);
    },
    addEvent(event) {
      const dt = tickToDayTime(this.tick);
      const full = {
        id: event.id ?? this.nextId('evt'),
        tick: this.tick,
        day: dt.day,
        time: dt.time,
        public: false,
        visibleToAgentIds: [],
        causes: [],
        consequences: [],
        importance: 2,
        payload: {},
        ...event
      };
      this.events.push(full);
      return full;
    },
    advanceTick() {
      this.tick += 1;
      const dt = tickToDayTime(this.tick);
      this.day = dt.day;
      this.time = dt.time;
    }
  };
  world.addEvent({ type: 'world_started', locationId: 'apartment', actorIds: ['player'], description: 'WorldMind simulation started in New Aarhus District 01.', public: true, importance: 3 });
  return world;
}
