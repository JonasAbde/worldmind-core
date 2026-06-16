# AGENTS.md — WorldMind / HermesWorld Core

Dette dokument er projektets agent-readable root context.

## Mission

Byg WorldMind som en simulation-first AI game engine, hvor NPC’er er sandboxed agents med memory, goals, skills, tools, relationships og permissions. Første mål er en dependency-light MVP, der beviser emergent story gennem `The Missing Delivery`.

## Projektprincipper

1. Simulation core før 3D.
2. Agents foreslår handlinger; World Engine validerer og eksekverer.
3. Event Log er sandheden.
4. Memory er agentens fortolkning.
5. Rumors er social spredning og kan være falske.
6. Story opstår fra simulation + Game Master interpretation.
7. Leno må ikke afsløre hidden truth uden evidence.
8. Guardrails er runtime-lag, ikke kun prompts.
9. MVP skal være testbar med evals.
10. Ingen real-world connectors før sandbox/shadow/approval-mode er designet.

## Hermes-instruktion

Brug alle relevante Hermes-features: skills, toolsets, slash commands, subagents/delegation, memory og session search, docs/context lookup, messaging gateway, queue/background, cron/automations, kanban, rollback/checkpoints, hooks, LSP diagnostics, model/provider routing, worktrees, Git workflow, tests/build/lint/typecheck, doctor/status/security-audit og verification gates.

## Safety baseline

- Read-only først ved audit.
- Ingen destructive changes uden eksplicit accept.
- Alt action/tool-use skal være permission-scoped.
- Tilføj tests før større refactors.
- Bevar dependency-light MVP, medmindre der er klar grund til at tilføje package.

## Current MVP

- Node.js ESM.
- Ingen eksterne dependencies.
- Tests via `node:test`.
- CLI simulation: `src/cli/simulate.js`.
- Dashboard output: `static-dashboard/index.html`.
