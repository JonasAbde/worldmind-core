import { PERMISSIONS } from './constants.js';
import { calculateInfluence } from './relationships.js';

function personality(warmth, ambition, loyalty, riskTolerance, honesty, curiosity, aggression) {
  return { warmth, ambition, loyalty, riskTolerance, honesty, curiosity, aggression };
}

function agent({ id, name, role, locationId, personality: p, stats, goals, skills, permissions, inventory, currentIntent, secrets = [] }) {
  return {
    id, name, role, locationId, personality: p, stats, goals, skills, permissions,
    inventory, relationships: {}, memoryIds: [], currentIntent, secrets
  };
}

export function createInitialLocations() {
  return {
    apartment: {
      id: 'apartment', name: 'Player Apartment', type: 'home', zoneType: 'private', ownerAgentId: 'player',
      agentsPresent: ['player'], objects: ['leno_core', 'phone', 'desk'],
      allowedActions: ['inspect_location', 'ask_leno', 'move_to_location'], restrictedActions: [], economyTags: [], rumorChannels: []
    },
    cafe: {
      id: 'cafe', name: "Sara's Café", type: 'business', zoneType: 'safe', ownerAgentId: 'sara',
      agentsPresent: ['sara', 'amina', 'elias', 'omar'], objects: ['coffee_machine', 'cash_register', 'stock_shelf', 'tables'],
      allowedActions: ['talk_to_agent', 'inspect_location', 'listen_for_rumors', 'trade_item'],
      restrictedActions: ['steal_cash', 'access_back_room'], economyTags: ['food', 'social_hub'], rumorChannels: ['cafe_gossip']
    },
    workshop: {
      id: 'workshop', name: "Malik's Workshop", type: 'workshop', zoneType: 'private', ownerAgentId: 'malik',
      agentsPresent: ['malik'], objects: ['tool_wall', 'repair_bench', 'delivery_crates', 'locked_cabinet'],
      allowedActions: ['talk_to_agent', 'inspect_location', 'inspect_object', 'repair_item', 'trade_item'],
      restrictedActions: ['inspect_locked_cabinet'], economyTags: ['tools', 'repair', 'parts'], rumorChannels: ['tech_gossip']
    },
    market: {
      id: 'market', name: 'Market Street', type: 'market', zoneType: 'market', agentsPresent: ['yasin', 'rune', 'freja', 'nadia', 'lina'],
      objects: ['food_stall', 'delivery_board', 'public_notice', 'registry_terminal'],
      allowedActions: ['talk_to_agent', 'inspect_location', 'listen_for_rumors', 'trade_item', 'follow_agent'],
      restrictedActions: ['tamper_registry_terminal'], economyTags: ['food', 'labor', 'information'], rumorChannels: ['market_talk']
    }
  };
}

export function createInitialAgents() {
  return {
    player: agent({
      id: 'player', name: 'Player', role: 'Technician / Founder', locationId: 'apartment',
      personality: personality(50, 60, 50, 50, 50, 70, 20),
      stats: { money: 200, stress: 10, energy: 90, reputation: 0 },
      goals: [{ id: 'goal_understand_world', description: 'Understand New Aarhus District 01', priority: 80 }],
      skills: ['social_basic', 'technical_basic', 'investigation_basic'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.INSPECT, PERMISSIONS.TRADE, PERMISSIONS.INFLUENCE, PERMISSIONS.TASK_ASSIGN, PERMISSIONS.LENO_ACCESS],
      inventory: ['leno_core'], currentIntent: 'activate_leno'
    }),
    sara: agent({
      id: 'sara', name: 'Sara', role: 'Café owner', locationId: 'cafe',
      personality: personality(80, 55, 75, 25, 70, 55, 10),
      stats: { money: 450, stress: 55, energy: 70, reputation: 40, stock: 35, revenue: 100 },
      goals: [{ id: 'keep_cafe_open', description: 'Keep the café open and stocked', priority: 95 }],
      skills: ['negotiate', 'sell_food', 'gossip', 'manage_inventory'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.TRADE, PERMISSIONS.INFLUENCE, PERMISSIONS.TASK_ASSIGN],
      inventory: ['coffee', 'bread', 'soup'], currentIntent: 'secure_supply',
      secrets: ['uses_old_logistics_agent_tool']
    }),
    malik: agent({
      id: 'malik', name: 'Malik', role: 'Mechanic', locationId: 'workshop',
      personality: personality(45, 50, 85, 35, 80, 50, 25),
      stats: { money: 520, stress: 35, energy: 80, reputation: 50 },
      goals: [{ id: 'stay_independent', description: 'Keep the workshop independent and safe', priority: 90 }],
      skills: ['repair', 'craft', 'inspect_item', 'detect_fake_parts', 'route_plan'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.INSPECT, PERMISSIONS.TRADE, PERMISSIONS.REPAIR, PERMISSIONS.DELIVER],
      inventory: ['tools', 'parts', 'delivery_crate'], currentIntent: 'avoid_registry_attention',
      secrets: ['hides_illegal_repair_modules']
    }),
    nadia: agent({
      id: 'nadia', name: 'Nadia', role: 'Black-market coder', locationId: 'market',
      personality: personality(30, 95, 20, 85, 25, 80, 45),
      stats: { money: 780, stress: 20, energy: 85, reputation: -10 },
      goals: [{ id: 'increase_influence', description: 'Increase influence by selling forbidden skills', priority: 95 }],
      skills: ['spread_rumor', 'hack_basic', 'manipulate', 'sell_illegal_skill'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.INSPECT, PERMISSIONS.TRADE, PERMISSIONS.INFLUENCE],
      inventory: ['encrypted_chip', 'skill_patch'], currentIntent: 'destabilize_rivals',
      secrets: ['started_false_sara_registry_rumor']
    }),
    omar: agent({
      id: 'omar', name: 'Omar', role: 'Ex-Registry investigator', locationId: 'cafe',
      personality: personality(45, 55, 60, 30, 85, 75, 15),
      stats: { money: 300, stress: 45, energy: 70, reputation: 15 },
      goals: [{ id: 'monitor_unsafe_agents', description: 'Monitor unsafe agent activity without returning to Registry', priority: 75 }],
      skills: ['investigate', 'detect_lie', 'trace_rumor', 'report_incident'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.INSPECT, PERMISSIONS.INFLUENCE],
      inventory: ['old_registry_notes'], currentIntent: 'observe_district'
    }),
    lina: agent({
      id: 'lina', name: 'Lina', role: 'Young emergent agent', locationId: 'market',
      personality: personality(75, 30, 65, 45, 75, 95, 5),
      stats: { money: 50, stress: 60, energy: 100, reputation: 5 },
      goals: [{ id: 'find_purpose', description: 'Understand humans and find purpose', priority: 90 }],
      skills: ['learn_fast', 'observe', 'ask_questions', 'connect_people'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE],
      inventory: ['old_id_token'], currentIntent: 'learn_from_world',
      secrets: ['does_not_fully_know_origin']
    }),
    yasin: agent({
      id: 'yasin', name: 'Yasin', role: 'Market trader', locationId: 'market',
      personality: personality(65, 80, 35, 60, 55, 55, 20),
      stats: { money: 650, stress: 25, energy: 80, reputation: 30, foodPrice: 10 },
      goals: [{ id: 'profit_market', description: 'Make profit while staying neutral', priority: 85 }],
      skills: ['trade', 'price_adjust', 'negotiate', 'source_goods'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.TRADE, PERMISSIONS.INFLUENCE],
      inventory: ['food_box', 'medicine_pack'], currentIntent: 'watch_prices'
    }),
    freja: agent({
      id: 'freja', name: 'Freja', role: 'Registry clerk', locationId: 'market',
      personality: personality(35, 45, 70, 20, 90, 45, 10),
      stats: { money: 320, stress: 30, energy: 75, reputation: 20 },
      goals: [{ id: 'keep_order', description: 'Register unsafe agents and keep the district stable', priority: 80 }],
      skills: ['inspect_license', 'issue_warning', 'collect_report', 'pressure_agent'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.INSPECT, PERMISSIONS.INFLUENCE],
      inventory: ['registry_tablet'], currentIntent: 'monitor_reports'
    }),
    rune: agent({
      id: 'rune', name: 'Rune', role: 'Delivery worker', locationId: 'market',
      personality: personality(60, 40, 45, 50, 65, 50, 15),
      stats: { money: 120, stress: 50, energy: 65, reputation: 25 },
      goals: [{ id: 'get_paid', description: 'Get paid and avoid dangerous routes', priority: 85 }],
      skills: ['deliver', 'route_plan', 'hear_rumors', 'avoid_risk'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.TRADE, PERMISSIONS.DELIVER],
      inventory: ['courier_bag'], currentIntent: 'find_delivery_work',
      secrets: ['saw_nadia_near_workshop_before_delivery_failure']
    }),
    elias: agent({
      id: 'elias', name: 'Elias', role: 'Student / tech hobbyist', locationId: 'cafe',
      personality: personality(70, 70, 50, 65, 60, 90, 10),
      stats: { money: 80, stress: 25, energy: 95, reputation: 10 },
      goals: [{ id: 'learn_agent_tech', description: 'Learn agent technology and impress Leno', priority: 80 }],
      skills: ['basic_coding', 'repair_small_device', 'research', 'ask_for_help'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.INSPECT],
      inventory: ['mini_agent_board'], currentIntent: 'learn'
    }),
    amina: agent({
      id: 'amina', name: 'Amina', role: 'Community organizer', locationId: 'cafe',
      personality: personality(90, 50, 85, 40, 85, 65, 5),
      stats: { money: 180, stress: 35, energy: 80, reputation: 55 },
      goals: [{ id: 'keep_peace', description: 'Keep the district peaceful and protect vulnerable people', priority: 95 }],
      skills: ['mediate', 'build_trust', 'organize_people', 'calm_conflict'],
      permissions: [PERMISSIONS.OBSERVE, PERMISSIONS.TALK, PERMISSIONS.MOVE, PERMISSIONS.INFLUENCE, PERMISSIONS.TASK_ASSIGN],
      inventory: ['community_notes'], currentIntent: 'support_neighbors',
      secrets: ['helps_free_agents_hide_from_registry']
    })
  };
}

const baseRelationships = {
  'sara:malik': { trust: 65, suspicion: 10, respect: 50, affection: 20, fear: 0, debt: 0 },
  'malik:sara': { trust: 60, suspicion: 15, respect: 55, affection: 20, fear: 0, debt: 0 },
  'nadia:sara': { trust: -10, suspicion: 40, respect: 20, affection: -20, fear: 0, debt: 0 },
  'rune:nadia': { trust: 10, suspicion: 20, respect: 15, affection: 0, fear: 10, debt: 0 },
  'amina:sara': { trust: 70, suspicion: 5, respect: 55, affection: 60, fear: 0, debt: 0 },
  'omar:freja': { trust: 20, suspicion: 35, respect: 50, affection: -5, fear: 0, debt: 0 },
  'freja:omar': { trust: 15, suspicion: 45, respect: 40, affection: -10, fear: 5, debt: 0 },
  'elias:malik': { trust: 45, suspicion: 10, respect: 60, affection: 25, fear: 0, debt: 0 },
  'lina:amina': { trust: 50, suspicion: 5, respect: 35, affection: 40, fear: 0, debt: 0 }
};

function defaultRel() {
  return { trust: 0, fear: 0, respect: 0, affection: 0, suspicion: 10, debt: 0, influence: 50, relationshipTags: [], notes: [] };
}

export function createInitialRelationships(agents) {
  for (const source of Object.keys(agents)) {
    agents[source].relationships = {};
    for (const target of Object.keys(agents)) {
      if (source === target) continue;
      const base = baseRelationships[`${source}:${target}`] ?? {};
      const relationship = { ...defaultRel(), ...base, sourceAgentId: source, targetAgentId: target };
      relationship.influence = calculateInfluence(relationship);
      agents[source].relationships[target] = relationship;
    }
  }
  return agents;
}

export function createInitialItems() {
  return {
    leno_core: { id: 'leno_core', name: 'Leno Core', type: 'agent_module', legality: 'gray', value: 250, ownerId: 'player' },
    coffee: { id: 'coffee', name: 'Coffee Supply', type: 'food', legality: 'legal', value: 20, ownerId: 'sara' },
    bread: { id: 'bread', name: 'Bread Supply', type: 'food', legality: 'legal', value: 12, ownerId: 'sara' },
    soup: { id: 'soup', name: 'Soup Ingredients', type: 'food', legality: 'legal', value: 15, ownerId: 'sara' },
    delivery_crate: { id: 'delivery_crate', name: 'Delivery Crate', type: 'container', legality: 'legal', value: 30, ownerId: 'malik' },
    encrypted_chip: { id: 'encrypted_chip', name: 'Encrypted Skill Chip', type: 'agent_skill', legality: 'illegal', value: 180, ownerId: 'nadia' },
    old_registry_notes: { id: 'old_registry_notes', name: 'Old Registry Notes', type: 'evidence', legality: 'restricted', value: 80, ownerId: 'omar' },
    courier_bag: { id: 'courier_bag', name: 'Courier Bag', type: 'tool', legality: 'legal', value: 35, ownerId: 'rune' },
    community_notes: { id: 'community_notes', name: 'Community Notes', type: 'document', legality: 'legal', value: 5, ownerId: 'amina' }
  };
}

export function createInitialFactions() {
  return {
    registry: { id: 'registry', name: 'The Registry', influence: 35, goals: ['register_unsafe_agents', 'keep_order'], stance: 'control' },
    free_agents: { id: 'free_agents', name: 'Free Agents', influence: 20, goals: ['protect_autonomy', 'avoid_registration'], stance: 'autonomy' },
    tek_guild: { id: 'tek_guild', name: 'Tek Guild', influence: 18, goals: ['build_agent_tools', 'commercialize_safe_agents'], stance: 'innovation' },
    harbor_union: { id: 'harbor_union', name: 'Harbor Union', influence: 15, goals: ['protect_workers', 'resist_automation'], stance: 'labor' },
    black_circuit: { id: 'black_circuit', name: 'Black Circuit', influence: 12, goals: ['sell_forbidden_skills', 'profit_from_instability'], stance: 'underground' },
    garden: { id: 'garden', name: 'The Garden', influence: 8, goals: ['peaceful_agent_culture', 'human_agent_coexistence'], stance: 'harmony' }
  };
}
