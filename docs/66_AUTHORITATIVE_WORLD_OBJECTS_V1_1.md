# WorldMind 1.1 — authoritative world objects

## Outcome

The authored 3D props are now simulation-facing world objects instead of decorative meshes. The World Engine owns identity, location, interaction, permission, risk, state transition and evidence effects. The clients render these fields and submit the supplied command.

## Command flow

```txt
click object
  -> visualCues props[] metadata
  -> use_object <objectId>
  -> resolve object definition
  -> validate actor location
  -> validate permission
  -> validate MVP risk limit
  -> execute inspect_object ActionRequest
  -> append world_object_interacted event
  -> grant explicitly whitelisted evidence
  -> derive current object state from Event Log
  -> return refreshed visualCues
```

## Runtime contract

`src/play/world-object-runtime.js` is the gameplay registry. It does not mutate the world directly. The existing action validator remains the execution gate, and `src/simulation/actions.ts` writes the canonical event.

Object state is derived from the latest matching `world_object_interacted` event. This avoids a second mutable state store and follows the project rule that Event Log is truth.

Every visual object cue exposes:

- stable object and location ids;
- `use_object` command;
- action label;
- required permission;
- risk level;
- current event-sourced state;
- availability and blocked reason;
- model transform and source lineage.

## Guardrails

- Remote use is rejected even if a client manually submits the command.
- Missing actor permissions are rejected server-side.
- Risk above the MVP limit is rejected.
- Unknown object ids cannot create events.
- Evidence is granted only from the registry allowlist.
- Mesh node names and metadata never determine gameplay truth.
- Hidden truth is not present in object definitions or client cues.

## Current gameplay examples

- Delivery drone diagnostics can reveal the already-authored `cafe_delivery_gap` observation.
- Apartment access control transitions from `locked` to `authenticated`.
- Transit and autonomous pod objects synchronize routes without implementing vehicle control prematurely.
- Utility and interior objects expose diagnostics and state but do not bypass inventory, economy or quest rules.

## Next extension

Add object-specific cooldowns, repair requirements, consumable inventory costs and agent tool proposals using the same action boundary. Those effects should remain event-backed and require explicit permission/risk definitions.
