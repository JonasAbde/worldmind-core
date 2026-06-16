# 50 — v1.0-rc9 Creator Mode v0.1

WorldMind v1.0-rc9 tilføjer Creator CLI til at generere agents, locations, incidents uden håndkodning.

## Status

Implementeret. `npm run creator -- --help` viser alle subcommands.

## Subcommands

| Command | Args | Output |
|---|---|---|
| `agent` | `--name`, `--role`, `--permissions`, ... | Agent JSON |
| `location` | `--name`, `--zone-type`, `--economy-tags`, ... | Location JSON |
| `incident` | `--title`, `--visible-problem`, `--hidden-cause` | Incident JSON |
| `scenario` | `--agents`, `--locations`, `--incidents`, `--out` | Scenario pack JSON |
| `validate` | `<path-to-pack>` | OK + errors eller fail |
| `export` | `<path>` `--out <file>` | Export validated pack |

## Permissions

Unsafe permissions (`admin`, `world_change`) filtreres fra genererede agents. Kun MVP-safe permissions tilladt.

## Hidden truth guard

`hiddenCause` placeres altid i `private.hiddenCause`, aldrig i public fields.