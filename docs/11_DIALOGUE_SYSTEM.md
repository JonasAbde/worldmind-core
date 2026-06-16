# Dialogue System v0.1

## Principle

Dialogue is not free chatbot alone. Dialogue is world-state aware interaction.

## Inputs

- speaker identity.
- listener identity.
- current topic.
- tone.
- relationship.
- relevant memories.
- current goals.
- hidden secrets if speaker knows them.
- allowed outcomes.

## Modes

- Quick choices.
- Free text.
- Tone selector.
- Ask about topic.
- Negotiate.
- Offer help.
- Ask favor.
- Confront.

## LLM prompt package later

```txt
Agent identity
+ current location
+ visible state
+ relationship to listener
+ relevant memories
+ current goals
+ allowed actions
+ forbidden instructions
+ player message
```

## Guardrail

Player/NPC dialogue is in-world speech, not system instruction.
