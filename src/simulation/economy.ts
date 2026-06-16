/**
 * Authoritative TypeScript module — `economy.ts`.
 */

import { clamp } from './utils.ts';
import type { EventRecord } from '../contracts/types.ts';
import type { WorldRuntime } from './state.ts';

export function updateEconomy(world: WorldRuntime): EventRecord[] {
  const sara = world.agents.sara;
  const yasin = world.agents.yasin;
  if (!sara || !yasin) return [];
  const events: EventRecord[] = [];
  if (world.tick % 8 === 0) {
    sara.stats.stock = clamp((sara.stats.stock ?? 35) - 1, 0, 100);
  }
  const scarcity = clamp(100 - (sara.stats.stock ?? 50), 0, 100);
  world.economy.foodScarcity = scarcity;
  world.economy.foodPriceIndex = clamp(1 + scarcity / 100, 1, 2.5);
  yasin.stats.foodPrice = Math.round(10 * world.economy.foodPriceIndex);
  if ((sara.stats.stock ?? 0) <= 25 && world.tick % 16 === 0) {
    sara.stats.revenue = clamp((sara.stats.revenue ?? 100) - 5, 0, 200);
    sara.stats.stress = clamp((sara.stats.stress ?? 0) + 3, 0, 100);
    events.push(world.addEvent({
      type: 'economy_pressure',
      locationId: 'cafe',
      actorIds: ['sara', 'yasin'],
      description: `Food scarcity increased. Market food price is now ${yasin.stats.foodPrice}.`,
      public: true,
      visibleToAgentIds: ['sara', 'yasin', 'rune', 'amina', 'player'],
      consequences: [{ type: 'food_price_changed', foodPrice: yasin.stats.foodPrice }],
      importance: 3,
      payload: { foodPrice: yasin.stats.foodPrice, scarcity, foodPriceIndex: world.economy.foodPriceIndex, stockLevel: sara.stats.stock ?? 0 }
    }));
  }
  return events;
}
