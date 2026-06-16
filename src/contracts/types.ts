/**
 * Shared data contracts for WorldMind.
 *
 * These types describe the canonical shape of every persisted and
 * in-memory record. They back the runtime validators in
 * `src/contracts/validators.js` and the dashboard/CLI projections.
 *
 * Every record is intentionally a plain JSON-friendly object so it
 * can be serialized to SQLite, JSON scenarios and HTTP bodies.
 */

export type AgentId = string;
export type LocationId = string;
export type SnapshotId = string;
export type BranchId = string;
export type RngStateNumber = number;

export type RiskLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type IncidentStatus = 'active' | 'investigating' | 'resolved' | 'open';
export type MemoryVisibility = 'public' | 'private' | 'faction' | 'agent';
export type BranchName = string;

export interface AgentStats {
  money?: number;
  stress?: number;
  stock?: number;
  foodPrice?: number;
  laborSkill?: number;
  foodPriceIndex?: number;
}

export interface Relationship {
  sourceAgentId: AgentId;
  targetAgentId: AgentId;
  trust: number;
  suspicion: number;
  respect: number;
  affection: number;
  debt?: number;
  influence?: number;
  fear?: number;
  tags?: string[];
  relationshipTags?: string[];
}

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  locationId: LocationId;
  homeLocationId?: LocationId;
  permissions: string[];
  goals?: string[];
  memoryIds: string[];
  relationships: Record<AgentId, Relationship>;
  currentIntent?: string;
  stats: AgentStats;
  factionIds?: string[];
  relationshipTags?: string[];
}

export interface Location {
  id: LocationId;
  name: string;
  type: string;
  zoneType: string;
  agentsPresent: AgentId[];
  objects?: string[];
}

export interface Item {
  id: string;
  name: string;
  type?: string;
  ownerAgentId?: AgentId;
  locationId?: LocationId;
}

export interface Faction {
  id: string;
  name: string;
  members?: AgentId[];
  reputation?: number;
  influence?: number;
  goals?: string[];
  stance?: string;
}

export interface MemoryRecord {
  id: string;
  agentId: AgentId;
  content: string;
  createdAtTick: number;
  type?: string;
  visibility?: MemoryVisibility;
  confidence?: number;
  decayRate?: number;
  importance?: number;
  lastAccessedTick?: number;
  emotionalWeight?: number;
  sentiment?: number;
  sourceAgentId?: AgentId;
  sourceEventId?: string;
  locked?: boolean;
  relatedAgentIds?: AgentId[];
  relatedItemIds?: string[];
  relatedLocationIds?: LocationId[];
  category?: string;
  public?: boolean;
  visibleToAgentIds?: AgentId[];
  causedByEventId?: string;
  day?: number;
  time?: string;
  tick?: number;
}

export interface RumorRecord {
  id: string;
  claim: string;
  sourceAgentId: AgentId;
  truthLevel: number;
  knownByAgentIds: AgentId[];
  spreadRate?: number;
  targetAgentIds?: AgentId[];
  emotionalTone?: string;
  resolvedAtTick?: number;
  resolvedByEventId?: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  status: IncidentStatus;
  createdAtTick?: number;
  visibleProblem?: string;
  hiddenCause?: string;
  knownFacts: string[];
  involvedAgentIds: AgentId[];
  possibleResolutions?: string[];
  resolutionState?: string;
  resolvedByEventId?: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'completed' | 'failed';
  ownerAgentId?: AgentId;
  requesterAgentId?: AgentId;
  risk?: RiskLevel;
  reward?: number;
  createdAtTick: number;
  dueTick?: number;
  completedAtTick?: number;
}

export interface EventRecord {
  id: string;
  type: string;
  tick?: number;
  day?: number;
  time?: string;
  public: boolean;
  visibleToAgentIds: AgentId[];
  causes: string[];
  consequences: string[];
  importance: number;
  locationId?: LocationId;
  actorIds: AgentId[];
  description?: string;
  payload: Record<string, unknown>;
  branchOriginSnapshotId?: SnapshotId | null;
  branchParentSnapshotId?: SnapshotId | null;
  branchName?: BranchName | null;
  branchNote?: string | null;
  source?: 'scenario' | 'snapshot' | 'runtime';
}

export interface PlayerKnowledge {
  evidenceIds: string[];
  knownRumorIds: string[];
  knownIncidentIds: string[];
  knownAgentIds: AgentId[];
}

export interface EconomyState {
  foodPriceIndex: number;
  foodScarcity: number;
  laborDemand: number;
  trustPressure: number;
}

export interface BranchMetadata {
  id: BranchId;
  worldId: string;
  name: BranchName;
  originSnapshotId: SnapshotId;
  parentSnapshotId: SnapshotId;
  createdAt: string;
  note?: string;
  currentSnapshotId?: SnapshotId | null;
  currentTick?: number;
  currentDay?: number;
  currentTime?: string;
  snapshotCount?: number;
}

export interface SnapshotMetadata {
  id: SnapshotId;
  worldId: string;
  branchId?: BranchId | null;
  branchName?: BranchName;
  parentSnapshotId?: SnapshotId | null;
  originSnapshotId?: SnapshotId | null;
  createdAt?: string;
  tick: number;
  day: number;
  time: string;
  memoryCount: number;
  eventCount: number;
  relationshipCount: number;
  rumorCount: number;
  incidentStatus: string;
}

export interface WorldState {
  kind: 'world_state';
  version: 2;
  id: string;
  name: string;
  worldId?: string;
  tick: number;
  day: number;
  time: string;
  rngState?: RngStateNumber | { state: RngStateNumber } | null;
  idCounters?: Record<string, number>;
  agents: Record<AgentId, Agent>;
  locations: Record<LocationId, Location>;
  items: Record<string, Item>;
  factions: Record<string, Faction>;
  memories: Record<string, MemoryRecord>;
  rumors: Record<string, RumorRecord>;
  incidents: Record<string, IncidentRecord>;
  tasks: Record<string, TaskRecord>;
  events: EventRecord[];
  relationshipEvents: Relationship[];
  playerKnowledge: PlayerKnowledge;
  economy: EconomyState;
  branchOriginSnapshotId?: SnapshotId | null;
  branchParentSnapshotId?: SnapshotId | null;
  branchName?: BranchName | null;
  branchNote?: string | null;
  currentSnapshotId?: SnapshotId | null;
  source?: 'scenario' | 'snapshot' | 'runtime';
  createdAtTick?: number;
}

export interface ScenarioContract {
  id: string;
  name: string;
  tick: number;
  day: number;
  time: string;
  agents: Record<AgentId, Agent>;
  locations: Record<LocationId, Location>;
  items: Record<string, Item>;
  factions: Record<string, Faction>;
  memories?: Record<string, MemoryRecord>;
  rumors?: Record<string, RumorRecord>;
  incidents?: Record<string, IncidentRecord>;
  tasks?: Record<string, TaskRecord>;
  events?: EventRecord[];
  relationshipEvents?: Relationship[];
  playerKnowledge: PlayerKnowledge;
  economy: EconomyState;
  worldId?: string;
  rngState?: RngStateNumber | { state: RngStateNumber } | null;
  idCounters?: Record<string, number>;
  branchOriginSnapshotId?: SnapshotId | null;
  branchParentSnapshotId?: SnapshotId | null;
  branchName?: BranchName | null;
  branchNote?: string | null;
  currentSnapshotId?: SnapshotId | null;
  source?: 'scenario' | 'snapshot' | 'runtime';
}

export type ActionRequest = {
  actorId: AgentId;
  actionId: string;
  targetAgentId?: AgentId;
  targetLocationId?: LocationId;
  [key: string]: unknown;
};

export interface DiffContract {
  version: 1;
  beforeSnapshotId?: SnapshotId | null;
  afterSnapshotId?: SnapshotId | null;
  agentLocationChanges: Array<{ agentId: AgentId; beforeLocationId: LocationId | null; afterLocationId: LocationId | null }>;
  relationshipChanges: Array<{ sourceAgentId: AgentId; targetAgentId: AgentId; before: Partial<Relationship>; after: Partial<Relationship> }>;
  newMemories: MemoryRecord[];
  newRumors: RumorRecord[];
  economyChanges: Array<{ field: string; before: unknown; after: unknown }>;
  incidentChanges: Array<{ incidentId: string; beforeStatus: IncidentStatus | null; afterStatus: IncidentStatus | null; beforeResolutionState: string | null; afterResolutionState: string | null }>;
}

export interface LenoContext {
  worldId: string;
  day: number;
  time: string;
  agentCount: number;
  memoryCount: number;
  rumorCount: number;
  incidentCount: number;
  openIncidents: Array<Pick<IncidentRecord, 'id' | 'title' | 'status' | 'knownFacts' | 'resolutionState'>>;
  resolvedIncidents: Array<Pick<IncidentRecord, 'id' | 'title' | 'knownFacts' | 'resolutionState'>>;
  recentEvents: Array<Pick<EventRecord, 'id' | 'type' | 'description' | 'day' | 'time'>>;
  evidence: PlayerKnowledge;
  hiddenCause: null;
  includeHiddenCause: boolean;
}
