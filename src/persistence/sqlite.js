import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { serializeWorldState } from '../simulation/state.js';
import { createWorld } from '../simulation/world.js';

function safeIdPart(value) {
  return String(value ?? 'default').replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function makeId(prefix, index) {
  return `${prefix}_${String(index).padStart(5, '0')}`;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function json(value) {
  return JSON.stringify(value);
}

function parseJson(value) {
  return value ? JSON.parse(value) : null;
}

export function openSqliteWorldStore({ dbPath = path.resolve('data/worldmind.sqlite') } = {}) {
  let db = null;

  const open = () => {
    if (!db) {
      ensureDir(dbPath);
      db = new Database(dbPath);
    }
    return db;
  };

  const runMigrations = () => {
    const database = open();
    database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS world_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        world_id TEXT NOT NULL,
        branch_id TEXT,
        branch_name TEXT,
        parent_snapshot_id TEXT,
        branch_origin_snapshot_id TEXT,
        branch_note TEXT,
        created_at TEXT NOT NULL,
        tick INTEGER NOT NULL,
        day INTEGER NOT NULL,
        time TEXT NOT NULL,
        rng_state INTEGER,
        state_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS timeline_branches (
        branch_id TEXT PRIMARY KEY,
        world_id TEXT NOT NULL,
        name TEXT NOT NULL,
        origin_snapshot_id TEXT NOT NULL,
        parent_snapshot_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        note TEXT
      );
      CREATE TABLE IF NOT EXISTS world_agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        world_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        world_id TEXT NOT NULL,
        memory_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        world_id TEXT NOT NULL,
        source_agent_id TEXT NOT NULL,
        target_agent_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world_rumors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        world_id TEXT NOT NULL,
        rumor_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world_incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        world_id TEXT NOT NULL,
        incident_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        world_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS economy_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        world_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_world_snapshots_world_id ON world_snapshots(world_id);
      CREATE INDEX IF NOT EXISTS idx_timeline_branches_world_id ON timeline_branches(world_id);
      CREATE INDEX IF NOT EXISTS idx_world_agents_snapshot_id ON world_agents(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_world_memories_snapshot_id ON world_memories(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_world_relationships_snapshot_id ON world_relationships(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_world_rumors_snapshot_id ON world_rumors(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_world_incidents_snapshot_id ON world_incidents(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_world_events_snapshot_id ON world_events(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_economy_snapshots_snapshot_id ON economy_snapshots(snapshot_id);
    `);
  };

  const persistEntityRows = (database, snapshotId, worldId, state) => {
    const insertAgent = database.prepare('INSERT INTO world_agents (snapshot_id, world_id, agent_id, payload_json) VALUES (?, ?, ?, ?)');
    const insertMemory = database.prepare('INSERT INTO world_memories (snapshot_id, world_id, memory_id, payload_json) VALUES (?, ?, ?, ?)');
    const insertRelationship = database.prepare('INSERT INTO world_relationships (snapshot_id, world_id, source_agent_id, target_agent_id, payload_json) VALUES (?, ?, ?, ?, ?)');
    const insertRumor = database.prepare('INSERT INTO world_rumors (snapshot_id, world_id, rumor_id, payload_json) VALUES (?, ?, ?, ?)');
    const insertIncident = database.prepare('INSERT INTO world_incidents (snapshot_id, world_id, incident_id, payload_json) VALUES (?, ?, ?, ?)');
    const insertEvent = database.prepare('INSERT INTO world_events (snapshot_id, world_id, event_id, payload_json) VALUES (?, ?, ?, ?)');
    const insertEconomy = database.prepare('INSERT INTO economy_snapshots (snapshot_id, world_id, payload_json) VALUES (?, ?, ?)');

    database.prepare('DELETE FROM world_agents WHERE snapshot_id = ?').run(snapshotId);
    database.prepare('DELETE FROM world_memories WHERE snapshot_id = ?').run(snapshotId);
    database.prepare('DELETE FROM world_relationships WHERE snapshot_id = ?').run(snapshotId);
    database.prepare('DELETE FROM world_rumors WHERE snapshot_id = ?').run(snapshotId);
    database.prepare('DELETE FROM world_incidents WHERE snapshot_id = ?').run(snapshotId);
    database.prepare('DELETE FROM world_events WHERE snapshot_id = ?').run(snapshotId);
    database.prepare('DELETE FROM economy_snapshots WHERE snapshot_id = ?').run(snapshotId);

    for (const agent of Object.values(state.agents)) {
      insertAgent.run(snapshotId, worldId, agent.id, json(agent));
      for (const rel of Object.values(agent.relationships ?? {})) {
        insertRelationship.run(snapshotId, worldId, agent.id, rel.targetAgentId ?? rel.target_agent_id ?? '', json(rel));
      }
    }
    for (const memory of Object.values(state.memories)) insertMemory.run(snapshotId, worldId, memory.id, json(memory));
    for (const rumor of Object.values(state.rumors)) insertRumor.run(snapshotId, worldId, rumor.id, json(rumor));
    for (const incident of Object.values(state.incidents)) insertIncident.run(snapshotId, worldId, incident.id, json(incident));
    for (const event of state.events) insertEvent.run(snapshotId, worldId, event.id, json(event));
    insertEconomy.run(snapshotId, worldId, json(state.economy));
  };

  const store = {
    init() {
      runMigrations();
      return store;
    },
    saveSnapshot(world, meta = {}) {
      runMigrations();
      const database = open();
      const snapshotSeq = database.prepare('SELECT COUNT(*) AS count FROM world_snapshots WHERE world_id = ?').get(world.id).count + 1;
      const snapshotId = makeId('snapshot', snapshotSeq);
      const branchName = meta.branchName ?? world.branchName ?? 'main';
      const parentSnapshotId = meta.parentSnapshotId ?? world.branchParentSnapshotId ?? null;
      const originSnapshotId = meta.originSnapshotId ?? world.branchOriginSnapshotId ?? snapshotId;
      const state = serializeWorldState(world, {
        branchOriginSnapshotId: originSnapshotId,
        branchParentSnapshotId: parentSnapshotId,
        branchName,
        branchNote: meta.note ?? world.branchNote ?? null,
        source: 'snapshot'
      });
      const branchSeq = database.prepare('SELECT COUNT(*) AS count FROM timeline_branches WHERE world_id = ? AND name = ?').get(world.id, branchName).count + 1;
      const branchId = makeId(`branch_${safeIdPart(branchName)}`, branchSeq);
      const createdAt = new Date().toISOString();
      const tx = database.transaction(() => {
        database.prepare(`
          INSERT INTO world_snapshots (
            snapshot_id, world_id, branch_id, branch_name, parent_snapshot_id, branch_origin_snapshot_id,
            branch_note, created_at, tick, day, time, rng_state, state_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          snapshotId,
          world.id,
          branchId,
          branchName,
          parentSnapshotId,
          originSnapshotId,
          meta.note ?? world.branchNote ?? null,
          createdAt,
          state.tick,
          state.day,
          state.time,
          state.rngState?.state ?? null,
          json(state)
        );
        database.prepare(`
          INSERT INTO timeline_branches (
            branch_id, world_id, name, origin_snapshot_id, parent_snapshot_id, created_at, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(branch_id) DO UPDATE SET
            world_id = excluded.world_id,
            name = excluded.name,
            origin_snapshot_id = excluded.origin_snapshot_id,
            parent_snapshot_id = excluded.parent_snapshot_id,
            note = excluded.note
        `).run(branchId, world.id, branchName, originSnapshotId, parentSnapshotId ?? snapshotId, createdAt, meta.note ?? world.branchNote ?? null);
        persistEntityRows(database, snapshotId, world.id, state);
      });
      tx();
      return { snapshotId, branchId, branchName, parentSnapshotId, originSnapshotId, worldId: world.id };
    },
    loadSnapshot(snapshotId) {
      runMigrations();
      const row = open().prepare('SELECT * FROM world_snapshots WHERE snapshot_id = ?').get(snapshotId);
      if (!row) throw new Error(`Snapshot not found: ${snapshotId}`);
      const state = parseJson(row.state_json);
      state.branchOriginSnapshotId = row.branch_origin_snapshot_id;
      state.branchParentSnapshotId = row.parent_snapshot_id;
      state.branchName = row.branch_name;
      state.branchNote = row.branch_note;
      return createWorld({ state });
    },
    createTimelineBranch({ snapshotId, name, note = '' }) {
      runMigrations();
      const database = open();
      const snapshot = database.prepare('SELECT * FROM world_snapshots WHERE snapshot_id = ?').get(snapshotId);
      if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);
      const seq = database.prepare('SELECT COUNT(*) AS count FROM timeline_branches WHERE world_id = ? AND name = ?').get(snapshot.world_id, name).count + 1;
      const branchId = makeId(`branch_${safeIdPart(name)}`, seq);
      const createdAt = new Date().toISOString();
      database.prepare(`
        INSERT INTO timeline_branches (
          branch_id, world_id, name, origin_snapshot_id, parent_snapshot_id, created_at, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(branch_id) DO UPDATE SET
          world_id = excluded.world_id,
          name = excluded.name,
          origin_snapshot_id = excluded.origin_snapshot_id,
          parent_snapshot_id = excluded.parent_snapshot_id,
          note = excluded.note
      `).run(branchId, snapshot.world_id, name, snapshot.snapshot_id, snapshot.snapshot_id, createdAt, note);
      return { id: branchId, worldId: snapshot.world_id, name, originSnapshotId: snapshot.snapshot_id, parentSnapshotId: snapshot.snapshot_id, note, createdAt };
    },
    listTimelineBranches(worldId) {
      runMigrations();
      return open().prepare('SELECT * FROM timeline_branches WHERE world_id = ? ORDER BY created_at ASC').all(worldId).map(row => ({
        id: row.branch_id,
        worldId: row.world_id,
        name: row.name,
        originSnapshotId: row.origin_snapshot_id,
        parentSnapshotId: row.parent_snapshot_id,
        createdAt: row.created_at,
        note: row.note
      }));
    },
    listSnapshots(worldId) {
      runMigrations();
      return open().prepare('SELECT * FROM world_snapshots WHERE world_id = ? ORDER BY created_at ASC').all(worldId).map(row => ({
        id: row.snapshot_id,
        worldId: row.world_id,
        branchId: row.branch_id,
        branchName: row.branch_name,
        parentSnapshotId: row.parent_snapshot_id,
        originSnapshotId: row.branch_origin_snapshot_id,
        createdAt: row.created_at,
        tick: row.tick,
        day: row.day,
        time: row.time
      }));
    },
    close() {
      if (db) {
        db.close();
        db = null;
      }
    }
  };

  return store;
}
