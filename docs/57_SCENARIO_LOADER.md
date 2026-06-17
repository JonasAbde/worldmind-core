# 57 — Scenario Loader + Content Pack JSON Schema (v1.0-rc12)

Sprint target: ship plan 54 medium-term targets.

## What this sprint delivers

The content/ tree now has a runtime loader and a content pack JSON
schema. Both were sitting on disk but were unused — codex authored
episode-specific data (3 episodes, 9 resolution paths, 3 incidents,
3 rumors, 7 evidence, 5 dialogue, 7 quests, visual boards) but no
runtime code read it. This sprint wires it up.

### Counts discovered

| Pack | Count |
| --- | --- |
| Episodes | 3 |
| Resolution paths | 9 |
| Incidents | 3 |
| Rumors | 3 |
| Evidence | 7 |
| Dialogue entries | 5 |
| Quests | 7 |

## Modules added

| Module | Purpose |
| --- | --- |
| `src/play/scenario-loader.js` | Reads content/episodes/, content/dialogue/, content/evidence/, content/incidents/, content/quests/, content/rumors/, content/resolution-paths/. Caches. Exposes typed accessors + aggregator. |
| `src/play/scenario-schema.js` | Lightweight JSON Schema validation (no external library — dependency-light MVP). 6 shape validators + pack validator + `validateAllScenarios()` aggregator. |
| `src/cli/validate-scenario-loader.js` | Audits that all packs can be loaded (30 structural checks). |
| `src/cli/validate-scenario-schema.js` | Audits that all entries conform to the schema (8 shape checks). |

## New CLIs

| Command | Purpose |
| --- | --- |
| `npm run validate:scenario-loader` | Confirms content tree loads end-to-end |
| `npm run validate:scenario-schema` | Confirms content entries match JSON Schema |

Both added to `ci:gate` (now 23 steps).

## Schema rules enforced

| Type | Required fields | Enum fields |
| --- | --- | --- |
| Episode | id, title, district | themes[], requiredSystems[] |
| ResolutionPath | id, label | risk ∈ low/medium/high, steps[], reward{} |
| Incident | id, title, locationId | riskLevel ∈ low/medium/high, status, linkedEvidence[] |
| Rumor | id, claim | truthLevel ∈ true/false_or_misleading/partial/unverified, sourceEvidenceId |
| Evidence | id | title OR label (both supported) |
| DialogueEntry | id, agentId, topic, line | tone, unlocks[] |

## Tests

2 new test files: `v43-scenario-loader.test.js` (19 tests) +
`v44-scenario-schema.test.js` (13 tests).

Total: **419/419** (up from 387, +32 new tests).

## What was deliberately NOT done

- No changes to the simulation engine or play-engine — scenario
  loader is read-only.
- No new dependencies — schema is a hand-rolled lightweight validator,
  consistent with the project's "dependency-light MVP" principle.
- No write API — only read accessors. Content authoring is still
  a JSON-editing workflow, not a runtime mutation.
- The `scenario/<episode-id>/hotspots.json` granularity from plan 54
  is implemented at the pack level (content/{dialogue,evidence,...}/
  *.json) rather than per-episode — this matches what codex actually
  authored on disk.

## Verification

```bash
npm test                          # 419/419
npm run typecheck                 # clean
npm run ci:gate                   # 23 steps, all green
npm run validate:scenario-loader  # 30 structural checks
npm run validate:scenario-schema  # 8 schema checks, 0 errors
```