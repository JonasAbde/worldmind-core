/**
 * Founder contract catalog and progression tiers for play runtime.
 */

export const FOUNDER_CONTRACT_CATALOG = [
  {
    id: 'delivery_sara_emergency',
    label: 'Emergency stock for Sara',
    customer: 'Sara',
    minBaseLevel: 0,
    payout: 25,
    upfrontCost: 8,
    reputationGain: 3,
    stockImpact: -4,
    energyCost: 6
  },
  {
    id: 'delivery_market_supplies',
    label: 'Market supply run',
    customer: 'Market vendors',
    minBaseLevel: 1,
    payout: 35,
    upfrontCost: 12,
    reputationGain: 4,
    stockImpact: -5,
    energyCost: 7
  },
  {
    id: 'delivery_workshop_parts',
    label: 'Workshop parts delivery',
    customer: 'Workshop',
    minBaseLevel: 2,
    payout: 50,
    upfrontCost: 18,
    reputationGain: 6,
    stockImpact: -6,
    energyCost: 8
  }
];

export function founderBaseLevelForContracts(contractsCompleted = 0) {
  if (contractsCompleted >= 6) return 2;
  if (contractsCompleted >= 3) return 1;
  return 0;
}

export function founderTierLabel(baseLevel = 0) {
  if (baseLevel >= 2) return 'Established operator';
  if (baseLevel >= 1) return 'District courier';
  return 'Starter runner';
}

export function listFounderContractOffers(founder = {}) {
  const baseLevel = founder.baseLevel ?? founderBaseLevelForContracts(founder.contractsCompleted ?? 0);
  const activeId = founder.activeContract?.templateId ?? founder.activeContract?.id ?? null;
  return FOUNDER_CONTRACT_CATALOG.map((template) => {
    const unlocked = baseLevel >= template.minBaseLevel;
    const status = activeId === template.id
      ? 'active'
      : unlocked
        ? 'available'
        : 'locked';
    return {
      id: template.id,
      label: template.label,
      customer: template.customer,
      payout: template.payout,
      upfrontCost: template.upfrontCost ?? 0,
      reputationGain: template.reputationGain,
      minBaseLevel: template.minBaseLevel,
      tierLabel: founderTierLabel(template.minBaseLevel),
      tierRequired: template.minBaseLevel,
      locked: status === 'locked',
      isDelivery: template.id.startsWith('delivery_'),
      status
    };
  });
}

export function resolveFounderContractTemplate(contractId, founder = {}) {
  const baseLevel = founder.baseLevel ?? founderBaseLevelForContracts(founder.contractsCompleted ?? 0);
  const template = FOUNDER_CONTRACT_CATALOG.find((c) => c.id === contractId)
    ?? FOUNDER_CONTRACT_CATALOG.find((c) => baseLevel >= c.minBaseLevel);
  if (!template) return null;
  if (baseLevel < template.minBaseLevel) return null;
  return template;
}

export function createActiveFounderContract(template, worldTick = 0) {
  return {
    id: `${template.id}_${worldTick}`,
    templateId: template.id,
    label: template.label,
    customer: template.customer,
    payout: template.payout,
    upfrontCost: template.upfrontCost ?? 0,
    reputationGain: template.reputationGain,
    stockImpact: template.stockImpact,
    energyCost: template.energyCost,
    status: 'active'
  };
}
