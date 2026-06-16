import { retrieveMemories } from './memory.js';

export function generateDialogueReply(world, { speakerId, listenerId = 'player', topic = 'delivery', tone = 'direct' }) {
  const speaker = world.agents[speakerId];
  const rel = speaker.relationships[listenerId];
  const memories = retrieveMemories(world, speakerId, { targetAgentId: listenerId, topic, limit: 3 });
  let reply;
  if (speakerId === 'sara' && topic.includes('delivery')) {
    reply = rel.trust > 30
      ? 'Malik plejer aldrig at svigte sådan her. Jeg tror nogen har påvirket ham.'
      : 'Jeg ved ikke, hvorfor du spørger. Jeg har allerede nok problemer.';
  } else if (speakerId === 'malik' && topic.includes('sara')) {
    reply = speaker.relationships.sara.suspicion > 50
      ? 'Der er noget galt med Sara og Registry. Jeg leverer ikke, før jeg ved mere.'
      : 'Sara har altid betalt til tiden. Hvis noget er galt, vil jeg høre beviser først.';
  } else if (speakerId === 'rune' && topic.includes('nadia')) {
    reply = rel.trust > 30 || rel.fear > 60
      ? 'Okay. Jeg så Nadia ved workshoppen før Malik nægtede leveringen.'
      : 'Jeg så måske noget, men jeg blander mig ikke uden grund.';
  } else if (speakerId === 'nadia') {
    reply = rel.respect > 50 && rel.trust < 20
      ? 'Vi behøver ikke stole på hinanden for at tjene på det her.'
      : 'Rygter? I den her by er rygter bare en anden slags valuta.';
  } else {
    reply = `${speaker.name} responds about ${topic}.`;
  }
  return { speakerId, listenerId, topic, tone, reply, memoryContext: memories.map(m => m.content) };
}
