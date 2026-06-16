# 51 — v1.0-rc9 Scenario Authoring Tools

WorldMind v1.0-rc9 tilføjer scenario pack builder + validator.

## Status

Implementeret i `src/cli/creator.js`.

## Scenario Pack Format

```json
{
  "kind": "scenario",
  "id": "scenario_x",
  "name": "Scenario Name",
  "agents": [...],
  "locations": [...],
  "incidents": [...]
}
```

## Validator Checks

- Duplicate IDs rejected
- Unsafe permissions rejected
- hiddenCause in public fields rejected
- All references must exist

## Creator Web Panel

Tilgængeligt via Phone tab → "Creator". Indehlder:

- Agent draft form (name, role)
- Location draft form (name, zone type)
- Incident draft form (title, problem)
- JSON preview pane
- Validate button
- Export button