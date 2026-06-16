# SKILLS.md — HermesWorld Core Development Skills

## skill: run-worldmind-eval

Command:

```bash
npm test && npm run check
```

Purpose: Verificerer at simulationen stadig skaber memory, relationships, rumors, economy changes og incident detection.

## skill: add-agent

Steps:

1. Tilføj agent i `src/simulation/seed.js`.
2. Giv personality, stats, goals, skills, permissions, inventory, secrets.
3. Tilføj base relationships.
4. Tilføj tests, hvis agenten påvirker incident/story.
5. Opdater docs/cast.

## skill: add-action

Steps:

1. Tilføj action id i `constants.js`.
2. Tilføj registry entry i `actions.js`.
3. Implementér validator/handler.
4. Sørg for event log + memory update.
5. Tilføj test for permission, world-state og konsekvens.

## skill: add-incident

Steps:

1. Definér trigger conditions i `incidents.js`.
2. Tilføj visible problem, hidden cause, known facts og resolutions.
3. Sørg for Leno ikke afslører hidden cause uden evidence.
4. Tilføj eval/test.

## skill: update-docs-after-code

Alle ændringer i simulation, actions, memory, economy, story eller Leno skal opdatere relevante docs.
