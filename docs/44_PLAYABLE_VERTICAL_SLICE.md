# Playable Vertical Slice (v1.0-rc4)

WorldMind v1.0-rc4 introducer den **spillable** vertikale slice —
spilleren kan nu udføre handlinger i verden, føre dialog med agenter,
indsamle evidens, og løse *The Missing Delivery* via **tre forskellige
resolution paths**.

## Hvad er nyt

| Feature | Beskrivelse |
|---|---|
| `npm run play` | Interaktivt playable loop med 14 player commands |
| `npm run demo:play` | Deterministisk walkthrough af alle 3 paths |
| `npm run validate:leno` | Auditerer Leno-summaries for hidden-truth leaks |
| `play --path={peaceful\|investigation\|founder}` | Kør en scripted path til resolution |
| Save/branch i play flow | `save` og `branch` commands integrerer med SQLite persistence |

## Player Commands (14)

| # | Command | Formål | ActionRequest |
|---:|---|---|---|
| 1 | `look` | Verdens overblik | (read-only) |
| 2 | `move <location>` | Flyt spilleren | `move_to_location` |
| 3 | `talk <agent>` | Start dialog | `talk_to_agent` |
| 4 | `ask <agent> <topic>` | Spørg om emne | `ask_about_topic` |
| 5 | `inspect <target>` | Inspicér location/agent | `inspect_location` / `ask_about_topic` |
| 6 | `listen_rumors <location>` | Lyt efter rygter | `listen_for_rumors` |
| 7 | `trace_rumor <rumor-id>` | Spor rygtets kilde | `trace_rumor` |
| 8 | `counter_rumor <rumor-id>` | Modbevis et rygte | `counter_rumor` |
| 9 | `pay <agent> <amount>` | Betal en agent | `pay_agent` |
| 10 | `ask_leno <topic>` | Spørg Leno | `ask_leno` |
| 11 | `status` | Vis state/evidence/suspicions | (read-only) |
| 12 | `save [name]` | Gem snapshot til SQLite | (sqlite) |
| 13 | `branch <name>` | Opret branch fra snapshot | (sqlite) |
| 14 | `quit` | Afslut | — |

## Resolution Paths (The Missing Delivery)

### 1. Peaceful Mediation
Spilleren hjælper Sara, beder Amina om at mediere, og betaler Malik en
lille sum. Verden resolver til `peaceful_mediation`.

```
inspect cafe → talk sara → ask amina (mediation) → pay malik 5
```

### 2. Investigation & Counter-Rumor
Spilleren spørger Rune om Nadia, sporer og modbeviser rygtet. Verden
resolver til `investigation_and_counter_rumor`. Dette er den **kanoniske
path** fordi den kræver `rumor_source_nadia` evidence for at Leno kan
afsløre kilden.

```
inspect cafe → listen_rumors market → ask rune "nadia"
  → trace_rumor <id> → counter_rumor <id>
```

### 3. Founder / Business Negotiation
Spilleren betaler Malik for en alternativ leverance og taler med Sara
om den nye plan.

```
inspect workshop → pay malik 15 → talk sara (alternative delivery)
```

## Dialogue Turn Output

Efter hver `talk` / `ask` printer CLI'en:

```
=== Dialogue turn ===
<agent> says: <message>
Revealed facts: <list>
Evidence collected: <evidence-ids>
Player options:
  - continue this thread
  - inspect the area
  - listen for rumors
  - ask Leno

=== Consequence panel ===
Relationships: sara: trust +3, fear +0
New memories: +1
Rumor changes: +1
Money: -5
Incident: The Missing Delivery — resolved (peaceful_mediation)
```

## Status Panel

`status` printer spillerens samlede evidence, suspectioner og
ubesvarede spørgsmål:

```
World: New Aarhus District 01, Day 2, 00:00.
Tick: 96
Agents: 11, Memories: 88, Rumors: 1, Incidents: 1.

--- Evidence ---
Known facts: topic_evidence, rumor_source_nadia
Suspected causes: (none)
Unresolved questions: (none)
Known rumors: A rumor connects Sara to Registry (truth: 50)
```

## Leno Evidence Guard (`validate:leno`)

Leno må **kun** afsløre skjulte sandheder (f.eks. at Nadia er
rygtekilden) når spilleren har samlet `rumor_source_nadia` evidence.
Auditoren tjekker for tre typer lækager:

| Regel | Detection | Severity |
|---|---|---|
| Source-defining Nadia mention | Regex mod `nadia is the source` etc. | **HARD leak** |
| Hidden cause literal | Regex mod `hidden cause` | **HARD leak** |
| Plain Nadia mention (no source) | Regex mod `nadia` | Soft warning (info only) |

Brug:

```bash
npm run validate:leno
echo "Nadia is the source" | npm run validate:leno --silent
npm run validate:leno scenarios/new-aarhus-district-01.json
```

Exit codes: 0 = clean, 1 = leak detected, 2 = invalid input.

## Deterministisk Demo

`npm run demo:play` kører alle 3 paths i sekvens mod canonical
scenariet og udskriver en struktureret rapport:

```json
{
  "ok": true,
  "kind": "demo",
  "mode": "all",
  "paths": [
    { "path": "peaceful", "resolutionPath": "peaceful_mediation", "incidentStatus": "resolved", "lenoAudit": { "ok": true, "leaks": 0 } },
    { "path": "investigation", "resolutionPath": "investigation_and_counter_rumor", "incidentStatus": "resolved", "lenoAudit": { "ok": true, "leaks": 0 } },
    { "path": "founder", "resolutionPath": "founder_negotiation", "incidentStatus": "resolved", "lenoAudit": { "ok": true, "leaks": 0 } }
  ],
  "headline": { "path": "peaceful", "resolutionPath": "peaceful_mediation", "incidentStatus": "resolved" }
}
```

Outputtet er byte-identisk mellem kør (deterministisk). Den
gemmer også en snapshot til `data/demo-play.sqlite`.

## Save / Branch Integration

`play` genbruger den eksisterende SQLite persistence foundation:

- `save` → `store.saveSnapshot(world, { branchName })`
- `branch` → `store.saveSnapshot(...)` + `store.createBranch(...)`

Eksisterende `saves` CLI subcommands (`list`, `inspect`, `restore`,
`timeline`, `diff`) virker stadig uændret.

## Test Coverage

`test/v14-playable-vertical-slice.test.js` (16 tests):

- play --help lister alle 13 commands
- play afviser ukendte commands pænt
- demo:play resolver og er deterministisk
- demo:play understøtter --path=investigation og --path=founder
- demo:play gemmer snapshot til sqlite
- validate:leno passerer en clean summary
- validate:leno fanger en kilde-definerende Nadia mention
- validate:leno tillader Nadia mention med evidence
- validate:leno læser fra stdin
- ci:gate inkluderer validate:leno

## Design Constraints Stadig Overholdt

- ✅ Event Log er sandheden
- ✅ Memory er agentens fortolkning
- ✅ Leno afslører ikke hidden truth uden evidence
- ✅ Agents foreslår; World Engine validerer og eksekverer
- ✅ Risk 4/5 actions stadig gated (max risk = 3 i MVP)
- ✅ Ingen React, ingen 3D, ingen multiplayer, ingen marketplace

## Næste Sprint Anbefaling

**v1.0-rc5: Interactive Web Play UI** — bind `play` CLI'en til en
minimal HTML/JS UI (stadig ingen React), så en founder kan klikke
gennem casen uden at skrive commands. Eller:

**v1.0-rc5: Agent Dialogue Generation** — kør Leno summaries
igennem en lille sprogmodel for at generere naturlige dialogue turns
i stedet for de nuværende skabelon-baserede outputs.
