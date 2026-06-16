# Unified Play v1 — rc.2 Release Notes

> **Track:** `feature/worldmind-unified-play-v1`  
> **Candidate tag:** `v1.0.0-rc.2` (after merge from `master` `02b49f1` baseline)  
> **Baseline:** WorldMind v1.0-rc8 (2D district view + phone/Leno UI)

Unified Play rc.2 ships the **visual gameplay shell**, a stable **Play API** for external clients, and **runtime contracts v21–v25** so consequence panels, founder progression, rumor backfire, and major-decision branching behave consistently in CLI, static web, and live server modes.

## What's in rc.2

### Visual Gameplay Shell v1

Three-column game layout replaces the debug-style two-column play UI.

| Area | Features |
|------|----------|
| **Topbar** | world, day, time, money, reputation, energy, Leno status, branch |
| **Left** | district SVG map + location scene image |
| **Center** | hotspot rail, dialogue, consequence panels |
| **Right** | NPC cards, Leno, case board tabs, rumor trail, founder panel, major decisions |
| **Bottom** | event feed, live consequence ticker, command fallback |

Key modules: `src/play/visual-game-shell.js`, `src/play/game-shell-model.js`, `content/worldmind/content-pack-v1.json`.

Live mode (`npm run play:server`) updates panels without reload after `POST /api/command`. **Branch-before-decision** modal prompts save+branch when a consequential command matches `gameShell.majorDecisions`.

See `docs/59_VISUAL_GAMEPLAY_SHELL_V1.md`.

### Play API Contract v1.0.0

Stable JSON contract between **worldmind-core** (`play-server`) and external clients (`worldmind-site` `/play`, tools).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | `apiVersion`, engine version, contract path |
| `GET /api/state` | Full boot payload: `gameShell`, `districtView`, `playerKnowledge`, `founder`, redaction policy |
| `POST /api/command` | Execute command; returns fresh `gameShell`, `playerSnapshot`, optional `majorDecisionPrompt` |

CORS: `WM_CORS_ORIGIN` (comma-separated origins). Version constant: `PLAY_API_VERSION` in `src/play/play-api-payload.js`.

See `docs/PLAY_API_CONTRACT.md`.

### Runtime contracts v21–v25

| Contract | File | What it guarantees |
|----------|------|-------------------|
| **v21** Action Outcome | `test/v21-action-outcome-contract.test.js` | Every player command returns `ok`, `kind`, `consequence` with full delta envelope (`moneyDelta`, `reputationDelta`, `energyDelta`, `evidenceDelta`, …); no hidden-truth leaks in result text; `pay >= 15` surfaces `majorDecisionPrompt` |
| **v22** Founder Loop | `test/v22-founder-contract-loop.test.js` | Founder gated until incident resolved; `start_delivery_workflow` / `run_delivery_contract` / `list_contracts`; one active contract; tier promotion after 3 and 6 completions; auto-unlock on all three resolution paths |
| **v23** Rumor Runtime | `test/v23-rumor-gameplay-runtime.test.js` | Rumors expose `sourceConfidence`, `distortionLevel`, `knownBy`, `spreadRisk`; counter-rumor reduces `truthLevel`; weak counter **backfires** (`payload.backfire: true`, spreadRisk rises) |
| **v24** Play API | `test/v24-play-api-contract.test.js` | `buildPlayStatePayload` includes `gameShell` + `districtView`; live server health/state/command/CORS contract |
| **v25** Major Decisions | `test/v25-major-decision-prompt.test.js` | `detectMajorDecisionFromCommand` for pay threshold, counter_rumor, founder tier unlock; `resolveMajorDecisionPrompt` prefers command match over consequence |

Gameplay logic remains **only** in `src/play/play-engine.js`. Clients must not duplicate simulation rules.

### Founder tiers

Three contract tiers in `src/play/founder-contracts.js`:

| Base level | Label | Unlocks |
|------------|-------|---------|
| 0 | Starter runner | Emergency stock for Sara |
| 1 | District courier | + Market supply run (after 3 completions) |
| 2 | Established operator | + Workshop parts delivery (after 6 completions) |

Founder panel unlocks when *The Missing Delivery* resolves (`founder_negotiation`, `peaceful_mediation`, or `investigation_and_counter_rumor`). `gameShell.founder` exposes catalog, active contract, and tier label for UI.

### Major decisions

Authored in content pack / quest `majorDecisions` plus runtime detectors:

- **Pay threshold** (`pay >= 15`) → founder negotiation branch suggested
- **Counter rumor** → branch suggested before social impact
- **Founder tier unlock** → prompt after contract completion promotes base level

`majorDecisionPrompt` on command responses drives the branch modal; `gameShell.majorDecisions[]` lists pending decisions for pre-check.

## Verification

```bash
npm test                    # 303 tests incl. v21–v26
npm run typecheck
npm run ci:gate

# Unified play gates
npm run play:web
npm run validate:web-play   # visual shell markers + leak audit
npm run validate:play-api   # Play API contract + gameShell schema

# Live server smoke
npm run play:server
# curl -s http://127.0.0.1:8080/api/state | jq .gameShell.founder
```

Site bridge local test:

```bash
# Terminal 1 (core)
WM_CORS_ORIGIN=http://localhost:5173 npm run play:server

# Terminal 2 (worldmind-site)
npm run dev
# Open http://localhost:5173/play
```

## Site bridge checklist (worldmind-site)

Repo: `JonasAbde/worldmind-site` (separate). Full checklist: `docs/60_WORLDMIND_SITE_PLAY_BRIDGE.md`.

| Step | Status in core | Site action |
|------|----------------|-------------|
| Core exposes `gameShell` on `/api/state` | ✅ rc.2 | Boot from JSON, not embedded HTML |
| `GET /api/health` + `apiVersion` | ✅ rc.2 | Offline fallback when `ok: false` |
| CORS `WM_CORS_ORIGIN` | ✅ rc.2 | Set `VITE_WORLDMIND_CORE_URL` |
| Visual shell richest UI | ✅ rc.2 | Option B: React shell from `gameShell` (recommended) |
| Founder unlock + contracts | ✅ v22 | Render `state.founder` / `gameShell.founder` |
| Rumor trail + backfire | ✅ v23 | Show `rumorTrail`; counter uses `majorDecisionPrompt` |
| Major-decision branch modal | ✅ v25 | Match `majorDecisions` before POST |
| Replace hardcoded rc8 stats in `product.ts` | ⏳ site | Dynamic health/version from `/api/health` |
| Deploy Worker proxy or core subdomain | ⏳ site | Production CORS + TLS |
| `/play` route + `WorldMindPlayPortal` | ⏳ site | Not in this repo |

## Non-goals (still out of rc.2)

- LLM-powered Leno dialogue (policy guards only)
- 3D / Babylon `visualCues` slot (reserved in contract, not implemented)
- Full delivery workflow state machine beyond contract loop
- Merging to `master` before `v1.0.0-rc.1` tag on baseline `02b49f1`

## Related docs

- `docs/59_VISUAL_GAMEPLAY_SHELL_V1.md` — layout and modules
- `docs/PLAY_API_CONTRACT.md` — API schema and redaction
- `docs/60_WORLDMIND_SITE_PLAY_BRIDGE.md` — site integration steps
- `HERMES_HANDOFF.md` — Hermes handoff status
