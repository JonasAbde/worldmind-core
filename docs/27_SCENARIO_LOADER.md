# Scenario Loader

## Goal

Let the simulation start from a validated JSON scenario file instead of only the built-in seed path.

## Canonical scenario

- `scenarios/new-aarhus-district-01.json`
- mirrors the canonical world-start state
- falls back to the built-in seed if no scenario is supplied

## Schema rules

A scenario must include:

- `id`
- `name`
- `tick`, `day`, `time`
- `agents`
- `locations`
- `items`
- `factions`
- `memories`
- `rumors`
- `incidents`
- `tasks`
- `events`
- `relationshipEvents`
- `playerKnowledge`
- `economy`

## Loader behavior

- `loadScenarioFile(path)` parses JSON and validates schema.
- `scenarioToWorldState(scenario)` normalizes the object into simulation state.
- `initializeScenario({ scenarioPath })` loads the JSON scenario when provided.
- If the scenario is omitted or invalid, the built-in seed path remains available.

## Validation

- scenario schema is checked before world creation
- scenario-loaded worlds must still pass the canonical 7-day regression
- hidden truth and evidence guards must behave identically to the default seed path

## Future expansion

- multiple scenario packs
- branching campaign folders
- authoring tools for scenario generation
- migration helpers for older scenario formats
