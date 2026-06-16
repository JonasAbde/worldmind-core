# WorldMind v1.0-rc8 2D district view + phone/Leno UI

WorldMind er en living AI-world simulation prototype. Projektet modellerer en lille near-future bydel, hvor agents har mål, memory, relationer, permissions, actions, rygter, økonomi og emergent incidents.

Arbejdstitler:

- **WorldMind**: spillet/platformen.
- **HermesWorld Core**: agent-runtime/simulation engine.
- **Leno Core**: spillerens companion-agent/UI-brain.
- **New Aarhus District 01**: første world/setting.

Kernen er ikke "NPC chatbot". Kernen er en simulation-first engine, hvor Event Log er sandheden, memory er agentens fortolkning, og hidden truth altid kræver evidence.

## Hvad der er inkluderet

- 10 NPC-agents + player.
- 4 locations.
- Action/tool system med validation.
- Memory system.
- Relationship math.
- Rumor propagation rules v0.1.
- Economy rules v0.1.
- Incident detector / emergent quest logic.
- Dialogue system v0.1.
- Leno prompt/model policy.
- Static dashboard generator.
- Optional SQLite persistence foundation.
- World snapshots + timeline branches.
- Canonical JSON scenario loader.
- Deterministic regression tests.
- Eval/test suite.
- Dokumentation til Hermes.
- **v0.4** data contracts + scenario/snapshot/diff/branch validators.
- **v0.5** TypeScript runtime migration foundation + `tsc --noEmit` gate.
- **v0.6** authoritative `.ts` runtime for contracts + simulator + dashboard.
- **v0.7** all 9 simulation modules migrated to `.ts` with `strict: true` default.
- **v0.8** `strictNullChecks: true` + `utils.ts` + `validate:risk` + `validate:event-log` + `diff:event-log` (10-step `ci:gate`, 89/89 tests).
- **v0.9** per-event-type payload validators + `validate:state` + `validate:risk --strict` (12-step `ci:gate`, 100/100 tests).
- **v1.0-rc1** all 9 event-emitters migrated to typed `payload` fields; `validate:event-log` flipped to **strict mode** as default; canonical 7-day run: **0 violations / 123 events** (var 108 i v0.9); Leno `lenoTickPayload` carries explicit `includeHiddenCause` evidence gate; 116/116 tests grønne.
- **v1.0-rc2** ny `worldmind saves` CLI med `list` / `inspect` / `restore` / `timeline` subcommands; deterministisk restore (byte-identical); auditerbar restore-log (actor/reason); branch/origin-kæde synlig; 126/126 tests grønne.
- **v1.0-rc3** visuelt dashboard med Save Browser table, Visual Timeline Tree, State Inspector, Incident Flow (Missing Delivery) og Visual Diff Panel. Ny `worldmind saves diff` CLI med structured diff (location, relationships, memories, rumors, economy, incidents + deltas). 137/137 tests grønne.
- **v1.0-rc4** playable vertical slice. Ny `worldmind play` CLI med 14 player commands (look/move/talk/ask/inspect/listen_rumors/trace_rumor/counter_rumor/pay/ask_leno/status/save/branch/quit) der alle mapper til autoritative ActionRequests. Dialogue turn + consequence panel rendering. 3 resolution paths (peaceful / investigation / founder) — alle løser *The Missing Delivery* deterministisk. Ny `worldmind demo:play` (deterministisk 3-path walkthrough, byte-identical output) og `worldmind validate:leno` (Leno evidence-guard auditor der fanger hidden-truth leaks). 153/153 tests grønne, 13-trins `ci:gate` grøn.
- **v1.0-rc5** interactive web play UI. Ny `worldmind play:web` CLI der genererer `static-play/index.html` (70KB) + `state.json` (122KB) — 11 centrale sektioner (Current Location, Visible Agents, Available Commands, Dialogue, Consequence, Evidence, Incident, Leno, Saves, Branches, Demo Paths) + Leno evidence-guard i UI. Shared `src/play/play-engine.js` (pure API) bruges af både CLI og web — ingen duplicate gameplay logic. Ny `worldmind validate:web-play` CI-gate. 171/171 tests grønne, 15-trins `ci:gate` grøn.
- **v1.0-rc7** live save browser UI + branch timeline restore. Ny `worldmind play:server` HTTP runtime uden framework og `worldmind validate:saves-ui` gate. Browseren kan nu liste/filtrere saves, inspecte snapshots, restore uden reload, oprette branches og vise snapshot-diffs via `/api/saves`, `/api/saves/:id`, `/api/saves/:id/restore`, `/api/branches` og `/api/saves/diff`. Save/branch/diff genbruger SQLite/timeline persistence; private memory/secrets redacteres i API/UI. 188/188 tests grønne.
- **v1.0-rc8** 2D district view + phone/Leno UI. `worldmind play:web` inkluderer nu `renderDistrictView()` med SVG kort over de 4 locations, `renderPhoneTabs()` med 8 tabs (Messages, Contacts, Rumors, Evidence, Jobs/Incident, Saves, Branches, Leno), `renderEventFeed()` panel. Location click → move command via `/api/command`. Leno overlay viser suggestions. 200/200 tests grønne.
- **Unified Play v1 — rc.2 candidate** (`feature/worldmind-unified-play-v1`): visual gameplay shell, Play API v1.0.0, runtime contracts v21–v25 (outcome envelope, founder tiers, rumor backfire, major decisions). **303/303 tests grønne.** Se `docs/61_RC2_UNIFIED_PLAY_RELEASE.md`, `docs/59_VISUAL_GAMEPLAY_SHELL_V1.md`, `docs/PLAY_API_CONTRACT.md`.

```bash
npm run validate:web-play
npm run validate:play-api
npm run play:server
```
## Kør projektet

```bash
npm install
npm test
npm run typecheck
npm run check
npm run ci:gate
npm start
```

**Creator mode** — build your own scenarios:

```bash
npm run creator -- new scenarios/my-district.json
npm run creator -- validate scenarios/my-district.json
```

Valgfri flags:

```bash
node src/cli/simulate.js --days 7 --dashboard --persist --db data/worldmind.sqlite
node src/cli/simulate.js --scenario scenarios/new-aarhus-district-01.json --days 7
node src/cli/simulate.js --load-snapshot snapshot_00001 --days 7 --persist
```

Efter `npm start` kan dashboard åbnes her:

```txt
static-dashboard/index.html
```

## Validators (v0.8)

```bash
npm run validate:scenario     # canonical scenario JSON
npm run validate:branch       # canonical branch JSON
npm run validate:dashboard    # dashboard HTML har alle 15 sektioner
npm run validate:action       # action payload mod canonical world
npm run validate:risk         # Risk 4/5 actions er forbudt i MVP
npm run validate:risk:strict   # + permission audit (actionId ↔ PERMISSIONS.X)
npm run validate:state         # 19-key WorldState shape check
npm run validate:event-log    # event-log invariants på 7-dages sim
npm run validate:event-log:strict  # + per-event-type payload check (strict)
npm run diff:canonical        # scenario vs runtime drift-check
npm run diff:event-log        # deterministisk event-log dobbeltkørsel
```

`ci:gate` kører alle ovenstående i sekvens og fejler på første regression.

## Foundation-succeskriterier

Efter 7 simulated days skal systemet kunne vise:

- 10 agents aktive.
- 4 locations ændrer state.
- 20+ memories.
- 10+ relationship changes.
- 5+ rumors spread.
- 3+ economy changes.
- 1 emergent incident.
- 3+ possible quest resolutions.
- 1 agent ændrer adfærd/relation pga. memory.
- Leno afslører ikke hidden truth uden evidence.
- Snapshot kan gemmes og loades igen.
- Branch metadata kan vises i event log og timeline-view.

## Startpunkt for Hermes

Læs i denne rækkefølge:

1. `HERMES_HANDOFF.md`
2. `AGENTS.md`
3. `docs/00_INDEX.md`
4. `docs/24_MVP_BUILD_PLAN.md`
8. `docs/35_STRICT_NULL_CHECKS.md` (v0.8)
9. `docs/36_EVENT_LOG_INVARIANTS.md` (v0.8)
10. `docs/37_RISK_VALIDATION.md` (v0.8)
11. `docs/38_PER_EVENT_TYPE_SCHEMAS.md` (v0.9)
12. `docs/39_STATE_VALIDATOR_AND_RISK_AUDIT.md` (v0.9)
13. `docs/40_TYPED_PAYLOAD_MIGRATION.md` (v1.0-rc1)
14. `docs/41_SAVE_BROWSER_AND_TIMELINE.md` (v1.0-rc2)
15. `docs/42_VISUAL_SAVE_BROWSER.md` (v1.0-rc3)
16. `docs/43_BRANCH_DIFF_AND_QA_INSPECTOR.md` (v1.0-rc3)
17. `docs/44_PLAYABLE_VERTICAL_SLICE.md` (v1.0-rc4)
18. `docs/45_INTERACTIVE_WEB_PLAY_UI.md` (v1.0-rc5)
19. `docs/47_SAVE_BROWSER_BRANCH_RESTORE.md` (v1.0-rc7)
13. Kør `npm run ci:gate`
9. Fortsæt med issues i `docs/26_ROADMAP.md`

## Spil WorldMind (v1.0-rc7)

```bash
# Interaktiv playable CLI
npm run play -- --help

# Deterministisk 3-path walkthrough (løser The Missing Delivery)
npm run demo:play

# Interaktiv web-play UI (åbn i browser efter generering)
npm run play:web
start static-play/index.html   # static mode

# Live web-play server + save/restore/branch UI
npm run play:server
start http://127.0.0.1:8080
npm run validate:saves-ui
# eller custom port: npm run play:server -- --port 9090

# Validering af web UI
npm run validate:web-play

# Ét enkelt player command
npm run play -- --command=look
npm run play -- --command=ask --target=rune --topic=nadia
npm run play -- --command=save --branch=player_arc

# Leno evidence-guard
npm run validate:leno
```
