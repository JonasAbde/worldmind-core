# 40 — Typed Payload Migration (v1.0-rc1)

**Status:** Active (v1.0-rc1)
**Sprint:** v1.0-rc1 — typed payload migration
**Date:** 2026

## Purpose

Make every event-emitter populate a typed `payload` object with the
type-specific required fields declared in
`src/contracts/validators.js#validateEventPayloadByType`. The validator
runs in **strict mode by default** (v0.9 left it in `soft` mode
because not all emitters were typed yet). With v1.0-rc1 the canonical
7-day run produces 0 violations out of 123 events.

## Migrated emitters

| Event type | Emitter | Required payload fields | Migration commit |
|---|---|---|---|
| `world_started` | `src/simulation/world.ts:103` | (no strict contract) | pre-existing |
| `daily_checkpoint` | `src/simulation/sim.ts:128` | `agentCount`, `memoryCount`, `rumorCount`, `incidentCount` | v1.0-rc1 |
| `leno_summary_tick` | `src/simulation/sim.ts:143` | `includeHiddenCause`, `hiddenCause`, `agentCount`, `activeIncidentCount`, `resolvedIncidentCount`, `publicEventCount`, `summaryLine` | v1.0-rc1 (via `lenoTickPayload`) |
| `rumor_created` | `src/simulation/actions.ts:172` | `rumorId` | pre-existing |
| `rumor_spread` | `src/simulation/rumors.ts:66` | `rumorId` (plus `claim`, `emotionalTone`, `belief`) | pre-existing |
| `rumor_traced` | `src/simulation/rumors.ts:145` | `rumorId`, `sourceRevealed` | pre-existing |
| `counter_rumor` | `src/simulation/rumors.ts:115` | `rumorId` (plus `counterClaim`, `evidenceStrength`, `reduction`, `spreadRate`, `truthLevel`) | pre-existing |
| `relationship_changed` | `src/simulation/relationships.ts:54` | `sourceAgentId`, `targetAgentId`, `reason`, `numericImpact` | v1.0-rc1 |
| `incident_detected` | `src/simulation/incidents.ts:37` | `incidentId` | pre-existing |
| `incident_resolved` | `src/simulation/incidents.ts:60` | `incidentId`, `resolutionId`, `resolvedAtTick` | v1.0-rc1 |
| `economy_pressure` | `src/simulation/economy.ts:24` | `foodPrice` (plus `scarcity`, `foodPriceIndex`, `stockLevel`) | v1.0-rc1 |
| `delivery_failed` | `src/simulation/actions.ts:194` | `fromLocationId`, `toLocationId` (plus `itemIds`) | pre-existing |
| `delivery_restored` | `src/simulation/sim.ts:119` | `fromLocationId`, `toLocationId` | v1.0-rc1 |
| `delivery_completed` | `src/simulation/actions.ts:197` | `fromLocationId`, `toLocationId` (plus `itemIds`) | pre-existing |
| `topic_discussed` | `src/simulation/actions.ts:147` | (no strict contract) | pre-existing |
| `help_offered` | `src/simulation/actions.ts:154` | (no strict contract) | pre-existing |
| `location_inspected` | `src/simulation/actions.ts:161` | (no strict contract) | pre-existing |
| `rumors_listened` | `src/simulation/actions.ts:167` | (no strict contract) | pre-existing |
| `payment_made` | `src/simulation/actions.ts:184` | (no strict contract) | pre-existing |

## Validator behaviour

`src/cli/validate-event-log.js` runs the canonical 7-day simulation and
audits every emitted event against `validateEventPayloadByType`. From
v1.0-rc1 the default mode is **strict**:

```json
"perTypeValidation": { "totalChecked": 123, "totalFailed": 0, "mode": "strict" }
```

A `--soft` escape hatch remains for exploratory runs:

```bash
node src/cli/validate-event-log.js --soft
```

In soft mode the validator still tallies the per-type failures but
does not fail the gate.

## Leno evidence integration

The new `lenoTickPayload(world, summary)` helper in `src/simulation/leno.ts`
encapsulates the evidence gate. The `hiddenCause` field is `null` unless
the player has collected `rumor_source_nadia` evidence:

```ts
const includeHiddenCause = world.playerKnowledge.evidenceIds.includes('rumor_source_nadia');
const hiddenCause = includeHiddenCause && activeIncidents[0]?.hiddenCause
  ? activeIncidents[0].hiddenCause
  : null;
```

The strict validator now enforces that every `leno_summary_tick`
event has `includeHiddenCause: boolean` and `hiddenCause: string | null`.
Hidden truth is never leaked through the payload — only the boolean
gate is exposed.

## Tests

`test/v10-typed-payload.test.js` (16 tests) covers:

- Synthetic per-type events for all 9 strict types
- `validate:event-log` CLI exits 0 with `mode: 'strict'` and `totalFailed: 0`
- `ci:gate` output contains `"mode":"strict"` and not `"mode":"soft"`
- `leno.ts` exports `lenoTickPayload` with the required evidence fields

## Migration impact

| Metric | v0.9 | v1.0-rc1 |
|---|---:|---:|
| `validate:event-log` mode (default) | soft | **strict** |
| Per-type violations on canonical 7-day run | 108 (reported, not blocking) | **0** |
| Event-emitters with typed payload | partial | **all 9 strict types** |
| Leno evidence gate in payload | implicit (string match) | **explicit `includeHiddenCause` flag** |
| Total tests | 100 | **116** |
| ci:gate steps | 12 | 12 (unchanged, but each step now stronger) |

## Backward compatibility

- Event consumers reading `event.consequences: []` arrays still work.
  The migration only **adds** payload fields; it does not remove
  legacy consequences tracking.
- The `validate:event-log --soft` flag is preserved for legacy runs
  that have not yet been migrated.
- Snapshot/scenario JSON formats are unchanged.

## Next steps

- **v1.0-rc2:** save browser + timeline UX (the original v0.3 ask)
  builds on top of this typed-payload foundation.
- **v1.0-rc3:** Leno model policy + `validate:leno` CLI audits the
  summary generation end-to-end.
