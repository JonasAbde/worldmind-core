# 52 — Full Featured Gameplay Expansion Plan

## Status

The current WorldMind build is a strong simulation foundation and a playable proof, but it is not yet the full-featured game experience Jonas wants.

This document upgrades the next sprint direction from "render assets in the UI" to a fuller gameplay vertical slice.

## Honest diagnosis

Current playable state:

- 14 player commands.
- 3 deterministic resolution paths for `The Missing Delivery`.
- Leno evidence guard.
- Save/branch/diff foundations.
- Web renderer with core sections.
- Asset registry and asset folder contracts.

Why this still feels thin:

- The player is still mostly typing commands or clicking generic command buttons.
- The UI does not yet feel like an in-world game interface.
- Locations are not interactive spaces with hotspots.
- NPCs are listed, not embodied as interactable agents with trust, suspicion and agenda cards.
- Evidence is IDs, not a real case board/investigation loop.
- Rumors exist, but do not yet feel like social gameplay.
- Economy exists, but the player cannot meaningfully trade, negotiate, start operations, or build a company loop.
- Timeline branches exist, but they are not yet presented as major player decisions with visible consequences.
- Progression exists as a foundation, but it does not yet unlock meaningful capabilities.

## Product target

WorldMind should feel like:

```txt
Disco Elysium investigation tension
+ Citizen-simulation/world-state consequences
+ Leno as an evidence-gated companion/UI-brain
+ founder/company progression
+ timeline branching
+ cozy Nordic cyberpunk identity
```

Not:

```txt
chatbot with NPC portraits
static dashboard with screenshots
asset showcase
generic command console
```

## Core gameplay loop

The next real loop should be:

```txt
Explore location
→ inspect hotspots
→ talk/ask/pressure/trade with agents
→ collect evidence or rumors
→ ask Leno for guarded interpretation
→ choose a strategy
→ execute action
→ see relationship/economy/faction/world consequences
→ save/branch before major decision
→ unlock new route, capability, trust, or founder opportunity
```

This loop must be visible in the UI, not only in JSON/state.

## Pillar 1 — In-world location play

### Required

- Location scene panel for current location.
- Clickable hotspots per location.
- Hotspots map to existing actions:
  - inspect crate
  - inspect café stock shelf
  - inspect Registry kiosk
  - inspect courier route
  - inspect repair bench
  - listen nearby
- Hotspots expose:
  - required command/action
  - risk level
  - possible evidence
  - visible/hidden state

### New data shape

```js
location.hotspots = [
  {
    id: 'cafe_delivery_crate',
    label: 'Delivery crate',
    action: { command: 'inspect', target: 'cafe', focus: 'delivery_crate' },
    evidenceId: 'cafe_delivery_gap',
    visible: true,
    risk: 1
  }
]
```

### UI

- Hotspot overlay cards on location image.
- Hotspot list fallback for accessibility.
- Selected hotspot opens an action detail panel.

## Pillar 2 — NPC interaction cards

### Required

Each visible NPC should render as a game card, not a text row:

- portrait/avatar
- name
- role
- mood/status
- trust/suspicion/fear toward player
- known topics
- available actions

### Actions

- Talk
- Ask about topic
- Offer help
- Pay / negotiate
- Ask Leno about this agent
- Inspect public profile

### UI principle

Clicking an agent should open an interaction drawer with:

```txt
Known facts
Relationship state
Possible topics
Risks
Actions
```

## Pillar 3 — Real case board

### Required

Evidence should stop being only `evidenceIds`.

The UI should show:

- evidence cards
- rumor cards
- unresolved questions
- suspect/source cards
- connections between evidence and rumors
- Leno redactions for hidden truth

### Game logic

Evidence should have metadata:

```js
{
  id: 'rumor_source_nadia',
  title: 'Rumor source clue',
  category: 'source_evidence',
  confidence: 80,
  discoveredAt: 'market',
  unlocks: ['leno_source_analysis', 'counter_rumor_safe'],
  hiddenTruthGate: true
}
```

### Leno guard

Leno must still separate:

- known facts
- likely patterns
- unknowns
- options

Leno cannot reveal source-defining truth without evidence.

## Pillar 4 — Rumor as gameplay

### Required

Rumor loop should be playable:

```txt
hear rumor
→ identify who knows it
→ compare trust/suspicion
→ trace chain
→ collect evidence
→ counter-rumor or weaponize it
→ relationships/factions shift
```

### UI

- Rumor trail visual.
- Known-by agent list.
- Distortion level.
- Spread risk.
- Counter-rumor success chance.

### Mechanics

Counter-rumor without evidence can backfire.
Counter-rumor with evidence should reduce spread and improve trust with affected agents.

## Pillar 5 — Meaningful consequences

Every major action should show a before/after consequence panel:

- relationship deltas
- memory changes
- rumor changes
- money changes
- stock/economy changes
- faction pressure
- incident status
- new unlocks

Do not hide consequences in raw JSON.

## Pillar 6 — Founder/company unlock

The founder path should become the first long-term progression loop.

### After The Missing Delivery

If the player resolves with business/founder route or helps Sara reliably:

- unlock small delivery workflow
- unlock apartment/base planning board
- unlock first company task
- unlock Malik/Sara contract possibility

### First company loop

```txt
take small contract
→ assign agent/help
→ pay cost
→ resolve delivery/workflow
→ gain reputation + money
→ upgrade base/tooling
→ unlock larger district operations
```

## Pillar 7 — Progression that matters

Current XP/level is not enough.

Progression should unlock actions:

- Investigation skill unlocks deeper evidence analysis.
- Social trust unlocks sensitive dialogue.
- Technical skill unlocks agent tools/automation.
- Founder capability unlocks contracts/base upgrades.
- Leno level unlocks better analysis, but still evidence-gated.
- Faction reputation unlocks faction-specific routes.

## Pillar 8 — Save/branch as gameplay

Save/branch should not feel like dev tooling only.

Use it for major decision moments:

```txt
Major decision detected:
- expose Nadia
- protect Sara privately
- sell info to Registry
- negotiate with Malik
- start delivery company route

UI prompts:
Create branch before this decision?
```

## Pillar 9 — Game UI structure

Recommended screen layout:

```txt
Top bar:
World / Day / Time / Money / Leno status

Left:
District map + current location

Center:
Location scene + hotspots + dialogue/action panel

Right:
NPC cards + Leno companion + case board tabs

Bottom:
Event feed + consequence ticker + command fallback
```

Tabs:

- Location
- Agents
- Case Board
- Rumors
- Leno
- Map
- Saves/Branches
- Founder/Base

## Sprint sequence

### Sprint A — Play UI as real game shell

- Replace generic text-first layout with game shell.
- Add stateful selected location/agent/hotspot/case tab.
- Add visual cards using existing assets.
- Keep command fallback.

### Sprint B — Hotspots + action cards

- Add hotspot model.
- Render hotspots on location images.
- Click hotspot triggers command/action.
- Add action preview before execution.

### Sprint C — NPC interaction drawer

- Render each NPC as card.
- Add selected NPC panel.
- Show relationship stats and topics.
- Wire action buttons.

### Sprint D — Case board / evidence graph

- Convert playerKnowledge into visible case-board model.
- Add evidence cards, rumor cards, unresolved questions.
- Add Leno guarded analysis panel.

### Sprint E — Consequence system UI

- Add before/after consequence ticker.
- Show trust/suspicion/money/economy/faction deltas.
- Add event feed.

### Sprint F — Founder unlock mini-loop

- After resolving delivery, unlock founder/base panel.
- Add first delivery workflow contract.
- Add basic company progression.

### Sprint G — Branch decisions as gameplay

- Detect major decisions.
- Prompt branch creation.
- Show branch outcome cards.
- Add snapshot diff as player-facing feature.

## Minimal code files likely affected

```txt
src/play/play-engine.js
src/play/web-renderer.js
src/play/district-view.js
src/play/progression.js
src/play/authoring.js
src/cli/play-web.js
src/cli/play-server.js
src/simulation/actions.ts
src/simulation/relationships.ts
src/simulation/rumors.ts
src/simulation/economy.ts
test/*play*.test.js
docs/*
```

## Acceptance criteria for full-featured founder demo

The founder demo is acceptable when a player can:

1. Open the web-play UI and understand the world visually.
2. Click the current location and inspect at least 3 hotspots.
3. Click an NPC and choose at least 3 meaningful interaction options.
4. Collect at least 3 evidence items through gameplay.
5. Hear and trace a rumor through the UI.
6. Ask Leno and receive guarded guidance.
7. See trust/money/rumor/consequence changes after actions.
8. Resolve The Missing Delivery through all 3 paths.
9. Create a branch before a major decision.
10. Compare outcome differences via save/snapshot diff.
11. Unlock the first founder/company opportunity after resolution.

## What not to do

- Do not just add more images.
- Do not only add styling.
- Do not replace simulation with scripted fake UI.
- Do not make Leno omniscient.
- Do not make final art claims before art lock.
- Do not introduce 3D/multiplayer/marketplace yet.

## Verdict

The current asset/render sprint is too thin if the goal is a real game feel.

The next sprint should be:

`v1.0-rc8 — Full Featured Gameplay Shell`

Not:

`asset rendering only`.

Ship target:

`SHIP only when gameplay loop is visible, clickable, consequential and replayable.`
