# Rumor Propagation Rules v0.1

## Purpose

Rumors connect memory, relationships, economy and story.

```txt
Memory → Rumor → Relationship Change → Incident → Quest
```

## Rumor fields

- claim
- sourceAgentId
- targetAgentIds
- truthLevel
- emotionalTone
- spreadRate
- knownByAgentIds
- distortionLevel
- active

## Spread rules

A rumor can spread when:

- speaker and listener share location.
- speaker knows rumor.
- listener does not know rumor.
- spread chance beats RNG.
- listener’s relationship to target makes belief plausible.

## Belief logic

- High trust toward target lowers belief.
- High suspicion toward target raises belief.
- Fear raises belief slightly.
- Repetition can increase confidence.

## Counter-rumor

Counter-rumors work best with evidence. Without evidence they can backfire later.

## Trace-rumor

Leno/player can trace rumors only through known events/evidence. Hidden source is not revealed unless evidence threshold is reached.
