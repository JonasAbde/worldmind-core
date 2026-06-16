# Interactive Web Play UI (v1.0-rc5)

WorldMind v1.0-rc5 bygger en **interaktiv web-play UI** ovenpå den
eksisterende playable engine. Siden er statisk genereret (ingen React),
bruger samme `play-engine` som CLI'en, og indeholder alle 11 centrale
play-sektioner + 3 demo paths + Leno evidence-guard.

## Hvad er nyt

| Feature | Beskrivelse |
|---|---|
| `npm run play:web` | Genererer `static-play/index.html` + `state.json` |
| `npm run validate:web-play` | Validerer at UI har alle 11 sektioner + 3 runtime markers |
| `static-play/index.html` | Statisk interaktiv side (70KB) — kan åbnes direkte i browser |
| `src/play/play-engine.js` | Pure-API shared engine (CLI + web bruger samme logik) |
| `src/play/web-renderer.js` | State → HTML rendering, med Leno evidence-guard |
| `src/cli/play-web.js` | CLI der genererer siden deterministisk |
| `src/cli/validate-web-play.js` | CI-gate der auditerer den genererede side |

## 11 Sektioner i Web-UI

1. **Current Location** — spillets aktuelle lokation + synlige agenter
2. **Visible Agents** — alle 11 NPCs med navn, rolle, lokation
3. **Available Commands** — 12 quick-action buttons + fri tekst-command input
4. **Dialogue** — seneste agent-samtale med revealed facts og evidence
5. **Consequence** — relationship-deltas, memories, rumors, money, incident
6. **Evidence** — known facts, suspected causes, unresolved questions + Leno summary
7. **Incident Progress** — The Missing Delivery status, resolution state, known facts
8. **Leno Suggestions** — summary (evidence-guarded) + 3 action suggestions
9. **Saves** — tabel over gemte snapshots
10. **Branches** — liste over timeline-branches
11. **Demo Paths** — 3 paths med steps (`peaceful` / `investigation` / `founder`)

## Leno Evidence Guard

UI'ets `renderEvidence` og `renderLeno` funktioner bruger
`applyLenoGuard` som **redakter kilde-definerende Nadia mentions**
(`/nadia is the source/i`) og erstatter dem med "REDACTED — evidence
required" — medmindre `rumor_source_nadia` er i spillerens
`playerKnowledge.evidenceIds`. Dette sikrer at UI'et aldrig lækker
hidden truth selvom Leno-modellen senere skulle foreslå det.

## Sådan spiller du

### Generer og åbn UI

```bash
# Generer siden
npm run play:web

# Åbn i browser (Windows)
start static-play/index.html

# Eller kør en simpel HTTP server for lettere udvikling
node -e "import('http').then(http => { const s = http.createServer((req, res) => { const fs=require('fs'); const p=req.url==='/'?'/index.html':req.url; res.end(fs.readFileSync('static-play'+p)); }); s.listen(8080, ()=>console.log('http://localhost:8080')); })"
```

### Quick-action buttons

Siden har 12 knapper: `look`, `status`, `ask_leno`, `inspect…`, `talk…`,
`ask…`, `listen_rumors`, `trace_rumor`, `counter_rumor`, `pay…`,
`save`, `branch`. De registrerer et klik og viser en status-banner
med CLI-kommandoen. Den **statiske** build er read-only — kørsel sker
via `npm run play -- --command=...` eller `npm run demo:play`.

### Fri tekst-command

Tekstfeltet accepterer strukturerede commands:
- `look`
- `talk sara`
- `ask rune nadia`
- `inspect cafe`
- `move workshop`
- `pay malik 10`
- `trace_rumor rumor_00001`
- `counter_rumor rumor_00001`
- `save my_arc`
- `branch my_branch`

## Demo Paths (3)

| Path | Steps | Resolution |
|---|---|---|
| Peaceful | `inspect cafe` → `talk sara` → `ask amina` → `pay malik 5` | `peaceful_mediation` |
| Investigation | `inspect cafe` → `listen_rumors market` → `ask rune nadia` → `trace_rumor` → `counter_rumor` | `investigation_and_counter_rumor` |
| Founder | `inspect workshop` → `pay malik 15` → `talk sara` | `founder_negotiation` |

## Arkitektur

```
src/play/play-engine.js     ← PURE: bootstrapWorld, resolveCommand, parseCommandText
src/play/web-renderer.js    ← PURE: renderWebPage, renderDialogueTurn, renderEvidence, ...
src/cli/play-web.js         ← CLI: kalder engine + renderer, skriver static-play/
src/cli/validate-web-play.js ← CLI: auditerer den genererede side
static-play/index.html      ← Output (deterministisk, byte-identical mellem kørsler)
static-play/state.json      ← Embedded initial state for browser-runtime
```

CLI'en (`src/cli/play.js`) og web-renderer bruger **samme**
`play-engine` så der er ingen duplicate gameplay logic. Web-versionen
er read-only i denne sprint — næste sprint kan tilføje en
server-side runtime der faktisk udfører commands.

## Test Coverage

`test/v15-interactive-web-play.test.js` (18 tests):

- play-engine eksporterer resolveCommand, bootstrapWorld, runScriptedPath
- play-engine: look, ask rune nadia, ukendt command afvises pænt
- play-engine: parseCommandText understøtter fri tekst
- web-renderer eksporterer alle render-funktioner
- web-renderer.renderWebPage producerer alle 11 sektioner
- web-renderer redakter Nadia uden evidence, tillader med evidence
- play:web genererer static-play/index.html
- play:web viser 3 demo paths
- play:web inkluderer text-input form + command buttons
- play:web er deterministisk (byte-identical mellem kørsler)
- validate:web-play passerer på frisk side
- validate:web-play afviser side med manglende sektioner
- validate:web-play --json fra custom page
- ci:gate inkluderer play:web og validate:web-play
- package.json har begge scripts

## Design Constraints Stadig Overholdt

- ✅ Event Log er sandheden
- ✅ Leno afslører ikke hidden truth uden `rumor_source_nadia` evidence
- ✅ World Engine validerer alt
- ✅ Risk 4/5 actions stadig gated
- ✅ Deterministisk restore stadig byte-identical
- ✅ Ingen React, ingen 3D, ingen multiplayer, ingen marketplace
- ✅ Ingen duplicate gameplay logic (CLI + web deler `play-engine`)
- ✅ Web UI er deterministisk + testbar (TDD 18/18 grønne)

## Næste Sprint Anbefaling

**v1.0-rc7 status:** Live server + Save Browser Restore er implementeret.
Se `docs/47_SAVE_BROWSER_BRANCH_RESTORE.md`.

**v1.0-rc8: UX polish + event stream**

- Dedicated snapshot inspect drawer.
- Branch restore confirmation flow.
- Visual branch tree layout.
- Event feed panel backed by `/api/events`.
- Optional SSE/WebSocket to replace polling.
