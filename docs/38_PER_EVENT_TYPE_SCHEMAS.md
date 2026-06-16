# 38. Per-event-type schema validation (v0.9)

## Goal

The generic `validateEventRecord` in `src/contracts/validators.js`
asserts that every event has `id`, `type`, `tick`, `day`, `time`,
`actorIds`, `description`, and a `payload` object. That's a necessary
minimum but not sufficient: each event type has its own required
payload fields, and downstream consumers (dashboard, branch diff,
narrative) depend on those.

v0.9 adds `validateEventPayloadByType` — a per-type schema that
asserts:

| Event type | Required payload fields |
|---|---|
| `rumor_created`, `rumor_spread`, `rumor_traced`, `counter_rumor` | `rumorId` |
| `incident_detected`, `incident_resolved`, `incident_advanced` | `incidentId` |
| `relationship_changed` | `sourceAgentId`, `targetAgentId` |
| `daily_checkpoint` | `agentCount`, `memoryCount`, `rumorCount`, `incidentCount` |
| `leno_summary_tick` | `includeHiddenCause`, `hiddenCause` |
| `economy_pressure` | `foodPrice` |
| `delivery_completed`, `delivery_failed`, `delivery_restored` | `fromLocationId`, `toLocationId` |

Events without a typed payload contract (e.g. `world_started`,
`help_offered`, `location_inspected`) skip the per-type check.

## Soft vs strict mode

The canonical runtime uses `consequences: []` arrays for some event
types (e.g. `relationship_changed` carries the source/target in
`consequences` rather than `payload`) and does not yet populate the
typed payload fields for every type. To avoid blocking the gate on
a known migration debt, `validate:event-log` runs in **soft mode**
by default: it reports the per-type tally as
`perTypeValidation: { totalChecked, totalFailed, mode: 'soft' }`
but does not fail the gate.

`validate:event-log:strict` flips it to **strict mode** and fails
on any per-type payload violation. The unit tests in
`test/v09-per-event-schemas.test.js` exercise the validator with
synthetic events that DO have typed payloads, so the validator
itself is covered even though the canonical run is not yet typed.

## CLI

```bash
npm run validate:event-log          # soft mode (default)
npm run validate:event-log:strict   # strict mode (fails on per-type violations)
```

## Test coverage

The unit tests in `test/v09-per-event-schemas.test.js` cover:

- `validateRumorSpreadEvent` requires `payload.rumorId`
- `validateIncidentEvent` requires `payload.incidentId`
- `validateRelationshipChangedEvent` requires `payload.sourceAgentId` + `targetAgentId`
- `validateDailyCheckpoint` requires the four count fields
- `validateLenoSummaryTick` requires `payload.includeHiddenCause` + `hiddenCause`

These tests use synthetic events that are well-formed per their
type contract, so the validator's logic is verified independent of
the canonical run's current payload shape.

## Migration plan

A separate sprint (v1.0 candidate) should migrate the runtime to
populate typed payload fields on every event. Once that lands,
`validate:event-log:strict` becomes the default and the soft mode
can be removed.
