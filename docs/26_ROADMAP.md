# Roadmap

## Completed sprints

### v0.1 — Simulation MVP
- 10 NPC-agents + player, 4 locations, 7-day canonical sim.
- Actions, memory, relationships, rumors, economy, incidents, dialogue v0.1.
- Leno policy + static dashboard generator.
- The Missing Delivery as emergent quest.
- Tests via `node:test`, eval in `simulate.js --assert`.

### v0.2 — Persistence + scenario foundation
- SQLite (better-sqlite3) snapshot store.
- JSON scenario loader with validation.
- Timeline branches with origin/parent metadata.
- Deterministic seed-based world construction.

### v0.3 — Save browser + timeline UX
- Visible save/snapshot listing with branch metadata.
- Timeline UX with origin-chain and fork-point metadata.
- Restore flow with deterministic RNG-state resume.
- Scenario/snapshot hygiene (required-field validation).

### v0.4 — Data contracts and validation
- Canonical `ScenarioContract`, `WorldState`, `SnapshotMetadata`, `BranchMetadata`, `DiffContract`, `LenoContext` types in `src/contracts/types.ts`.
- Runtime validators in `src/contracts/validators.js`.
- Zod-lite parse wrappers in `src/contracts/parse.js`.
- CLI gates: `validate:scenario`, `validate:branch`, `validate:diff`, `validate:dashboard`.

### v0.5 — TypeScript migration foundation
- `tsc --noEmit` gate via `npm run typecheck`.
- TypeScript façades for the four core simulation files (`state`, `scenario-loader`, `world`, `sim`).
- `.js` re-export shims for backward compatibility.
- Type information flows into the dashboard and Leno summary paths.

### v0.6 — Authoritative TypeScript runtime
- Full `.ts` bodies for the four façade files; `.js` shims removed.
- `strict: true` enabled by default in `tsconfig.json` (with `strictNullChecks: false` for that sprint).
- `runtime.d.ts` bridge between JS and TS callers.
- `diff-checker.js` with `--scenario` for scenario-vs-runtime drift detection.

### v0.7 — Strict TypeScript default
- All 9 remaining simulation modules migrated to `.ts`: `memory`, `rumors`, `actions`, `relationships`, `economy`, `incidents`, `dashboard`, `dialogue`, `leno`.
- `runtime.d.ts` and `utils.d.ts` bridges removed.
- `validate:action` CLI gate.
- 75/75 tests grøn; `ci:gate` expanded to 6 steps.

### v0.8 — Strict invariants + risk gates
- `strictNullChecks: true` flipped on. 26 nullable-access sites fixed with explicit `?? 0` / `?? ''` / `?? []` defaults.
- `src/simulation/utils.js` → `src/simulation/utils.ts` (last simulation JS file migrated).
- `validate:risk` CLI: source-parses `actions.ts` and enforces that no action has `risk > ACTION_RISK_LIMIT_MVP = 3`.
- `validate:event-log` CLI: enforces 8 invariants on the 7-day canonical sim (1 world_started, world tick = 672, ≥1 daily_checkpoint, no invalid actor/location refs, valid incidentIds, etc.).
- `diff:event-log` subcommand: runs the canonical sim twice and asserts deterministic event logs.
- 89/89 tests grøn; `ci:gate` expanded to 10 steps.
- Source-reading regression test for Leno evidence-guard (no `hiddenCause.match` string-leak fallback).

### v0.9 — Per-event-type schema + state validator + risk audit  *(current)*
- `validateEventPayloadByType` in `src/contracts/validators.js`: per-type payload schema for 9 event categories (rumor, incident, relationship, daily_checkpoint, leno_summary_tick, economy_pressure, delivery_*).
- `validate:event-log:strict` mode that fails the gate on any per-type payload violation. Soft mode is the default and reports the tally without blocking.
- `validate:state` CLI: asserts the 19-key canonical `WorldState` shape against a JSON file.
- `validate:risk --strict` mode that audits actionId ↔ `PERMISSIONS.X` mapping.
- 100/100 tests grøn; `ci:gate` expanded to 12 steps.

### v0.9 — Per-event-type schema + state validator + risk audit  ✅

### v1.0-rc1 — Typed payload migration  ✅

### v1.0-rc2 — Save browser + timeline UX  *(current)*
- Ny `worldmind saves` CLI: `list` / `inspect` / `restore` / `timeline` subcommands
- Deterministisk restore (byte-identical mellem på hinanden følgende kald)
- Auditerbar restore-log (action, snapshotId, actor, reason, restoredAtTick)
- Branch/origin-kæde synlig i timeline med `parentSnapshotId` chain
- Argument-parser understøtter nu både `--key value` og `--key=value`
### v1.0-rc2 — Save browser + timeline UX  ✅

### v1.0-rc3 — Visual save browser + branch diff + QA inspector  *(current)*
- Dashboard med 20 sektioner inkl. Save Browser, Visual Timeline Tree, State Inspector, Incident Flow, Visual Diff Panel
- `worldmind saves diff <a> <b>` CLI med structured diff (location, relationships, memories, rumors, economy, incidents + deltas)
- Incident flow viser The Missing Delivery's 5-step trace (detected → evidence → counter → restored → resolved)
- State inspector med 8 KPI tiles + top-3 memories + top-3 rumors
- 137/137 tests grønne, ci:gate 12/12 grønne

### v1.0-rc4 — Leno policy audit + interactive dashboard  *(næste)*
- React dashboard (optional companion).
- Authoring tools (creator mode v0.1).
- 2D district view.
- Phone UI + Leno overlay.
- Real Leno model integration behind deterministic mocks.
- Player progression + inventory + faction pressure.

## Non-goals (until v1.0)

- 3D client.
- Multiplayer.
- Marketplace.
- Real-world connectors.

## Non-negotiables (carried through every sprint)

- Do not leak hidden truth to Leno/player without evidence.
- Do not allow agents to self-grant permissions.
- Do not allow tool execution without validation.
- Keep Event Log as source of truth.
- Add tests for every new core mechanic.
- Risk 4/5 actions are forbidden in MVP (enforced by `validate:risk`).

## Verification gate (every sprint)

```bash
npm test              # 89/89 currently grøn
npm run typecheck     # strict + strictNullChecks clean
npm run check         # typecheck + MVP-eval passed
npm run ci:gate       # 10 steps currently grøn
npm start             # dashboard regenereret med alle eval-kriterier
```
