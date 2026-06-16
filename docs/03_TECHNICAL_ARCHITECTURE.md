# Technical Architecture

## Current prototype stack

- Runtime: Node.js ESM.
- Dependencies: none.
- Tests: `node:test`.
- Dashboard: static HTML generated from simulation.

## Target architecture

```txt
Game Client / Dashboard
  → API Server
  → WorldMind Simulation Core
      → Event Log
      → World State DB
      → Action Validator
      → Agent Runtime
      → Memory Engine
      → Relationship Engine
      → Rumor Engine
      → Economy Engine
      → Incident/Quest Engine
      → Leno Companion Layer
      → Model Router
```

## Model architecture

- Tiny/rule engine: routines and ticks.
- Small model: simple dialogue.
- Medium model: negotiation/reflection.
- Strong model: Leno, major story, faction strategy.
- Embedding model: memory search.
- Critic model: safety and tool-call validation.
- Creator model: generate worlds/agents/scenarios.

## Persistence target

- v0.1: in-memory.
- v0.2: SQLite.
- v0.3: Postgres + pgvector/Qdrant.
- Later: event sourcing + snapshots + timeline branches.
