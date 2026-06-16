# Data Model

## Source of truth

- Event Log = what actually happened.
- Memory = what an agent believes/h remembers.
- Rumor = social spread, not necessarily truth.
- Relationship = emotional/social state.
- Incident = detected gameplay opportunity.

## Core entities

- Agent
- Location
- Item
- Faction
- WorldEvent
- Memory
- Relationship
- Rumor
- Task
- Incident
- SaveSnapshot
- TimelineBranch

Current code models are in `src/simulation/*`.

## Agent key fields

- `id`, `name`, `role`, `locationId`
- `personality`
- `stats`
- `goals`
- `skills`
- `permissions`
- `inventory`
- `relationships`
- `memoryIds`
- `secrets`

## Event key fields

- `type`, `tick`, `day`, `time`
- `locationId`, `actorIds`
- `description`
- `public`, `visibleToAgentIds`
- `causes`, `consequences`
- `importance`, `payload`
