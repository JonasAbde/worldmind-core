/**
 * Authoritative TypeScript module — `dialogue.ts`.
 */

import { retrieveMemories } from './memory.ts';
import type { AgentId } from '../contracts/types.ts';
import type { WorldRuntime } from './state.ts';

interface DialogueOptions {
  speakerId: AgentId;
  listenerId?: AgentId;
  topic?: string;
  tone?: string;
}

export interface DialogueReply {
  speakerId: AgentId;
  listenerId: AgentId;
  topic: string;
  tone: string;
  reply: string;
  memoryContext: string[];
}

export function generateDialogueReply(world: WorldRuntime, options: DialogueOptions): DialogueReply {
  const { speakerId, listenerId = 'player', topic = 'delivery', tone = 'direct' } = options;
  const speaker = world.agents[speakerId];
  const rel = speaker.relationships[listenerId];
  const memories = retrieveMemories(world, speakerId, { targetAgentId: listenerId, topic, limit: 3 });
  let reply: string;
  if (speakerId === 'sara' && topic.includes('delivery')) {
    reply = rel.trust > 30
      ? 'Malik plejer aldrig at svigte s\u00e5dan her. Jeg tror nogen har p\u00e5virket ham.'
      : 'Jeg ved ikke, hvorfor du sp\u00f8rger. Jeg har allerede nok problemer.';
  } else if (speakerId === 'malik' && topic.includes('sara')) {
    reply = speaker.relationships.sara.suspicion > 50
      ? 'Der er noget galt med Sara og Registry. Jeg leverer ikke, f\u00f8r jeg ved mere.'
      : 'Sara har altid betalt til tiden. Hvis noget er galt, vil jeg h\u00f8re beviser f\u00f8rst.';
  } else if (speakerId === 'rune' && topic.includes('nadia')) {
    reply = (rel.trust > 30 || (rel.fear ?? 0) > 60)
      ? 'Okay. Jeg s\u00e5 Nadia ved workshoppen f\u00f8r Malik n\u00e6gtede leveringen.'
      : 'Jeg s\u00e5 m\u00e5ske noget, men jeg blander mig ikke uden grund.';
  } else if (speakerId === 'nadia') {
    reply = rel.respect > 50 && rel.trust < 20
      ? 'Vi beh\u00f8ver ikke stole p\u00e5 hinanden for at tjene p\u00e5 det her.'
      : 'Rygter? I den her by er rygter bare en anden slags valuta.';
  } else {
    reply = `${speaker.name} responds about ${topic}.`;
  }
  return {
    speakerId,
    listenerId,
    topic,
    tone,
    reply,
    memoryContext: memories.map((m) => m.content)
  };
}
