export const TICKS_PER_DAY = 96;
export const DEFAULT_SIM_DAYS = 7;
export const MEMORY_CREATE_THRESHOLD = 50;

export const RISK = {
  OBSERVE: 0,
  SMALL_SOCIAL: 1,
  MEDIUM_SOCIAL: 2,
  RUMOR: 3,
  RESTRICTED: 4,
  WORLD_CHANGING: 5
};

export const PERMISSIONS = {
  OBSERVE: 'observe',
  TALK: 'talk',
  MOVE: 'move',
  INSPECT: 'inspect',
  TRADE: 'trade',
  INFLUENCE: 'influence',
  TASK_ASSIGN: 'task_assign',
  REPAIR: 'repair',
  DELIVER: 'deliver',
  REFLECT: 'reflect',
  SYSTEM: 'system',
  LENO_ACCESS: 'leno_access'
};

export const ACTIONS = {
  MOVE_TO_LOCATION: 'move_to_location',
  TALK_TO_AGENT: 'talk_to_agent',
  ASK_ABOUT_TOPIC: 'ask_about_topic',
  OFFER_HELP: 'offer_help',
  ASK_FAVOR: 'ask_favor',
  INSPECT_LOCATION: 'inspect_location',
  INSPECT_OBJECT: 'inspect_object',
  FOLLOW_AGENT: 'follow_agent',
  LISTEN_FOR_RUMORS: 'listen_for_rumors',
  SPREAD_RUMOR: 'spread_rumor',
  COUNTER_RUMOR: 'counter_rumor',
  TRACE_RUMOR: 'trace_rumor',
  TRADE_ITEM: 'trade_item',
  PAY_AGENT: 'pay_agent',
  NEGOTIATE_DEAL: 'negotiate_deal',
  ASSIGN_TASK: 'assign_task',
  ACCEPT_TASK: 'accept_task',
  COMPLETE_TASK: 'complete_task',
  REPAIR_ITEM: 'repair_item',
  DELIVER_GOODS: 'deliver_goods',
  CREATE_MEMORY: 'create_memory',
  REFLECT_ON_EVENT: 'reflect_on_event',
  ASK_LENO: 'ask_leno',
  LENO_SUMMARIZE: 'leno_summarize',
  LENO_SUGGEST_ACTIONS: 'leno_suggest_actions'
};

export const ACTION_RISK_LIMIT_MVP = RISK.RUMOR;
