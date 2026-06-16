# Tool / Action System v0.1

## Principle

Agents and player do not directly mutate the world. They request actions. World Engine validates and executes.

```txt
Action request → schema → actor → permission → skill → location → world-state → risk → execute → event → memory → relationship → incident
```

## v0.1 actions

- `move_to_location`
- `talk_to_agent`
- `ask_about_topic`
- `offer_help`
- `ask_favor`
- `inspect_location`
- `inspect_object`
- `follow_agent`
- `listen_for_rumors`
- `spread_rumor`
- `counter_rumor`
- `trace_rumor`
- `trade_item`
- `pay_agent`
- `negotiate_deal`
- `assign_task`
- `accept_task`
- `complete_task`
- `repair_item`
- `deliver_goods`
- `ask_leno`

## MVP risk limit

Risk 0-3 allowed. Risk 4-5 disabled in v0.1.

## Permission principle

No agent can:

- grant self permissions.
- alter world rules.
- bypass validators.
- execute admin actions.
