import { POINTS_PER_CURRENCY_UNIT } from '../../common/constants';

interface PromotionRule {
  minSpend: number | { toNumber(): number };
  pointsAwarded: number;
  multiplier: number;
  dayOfWeek: string | null;
}

interface PromotionWithRules {
  id: string;
  name: string;
  type: string;
  rules: PromotionRule[];
}

interface CalculationResult {
  pointsEarned: number;
  promotionId: string | null;
  promotionName: string | null;
}

const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function calculatePoints(
  orderAmount: number,
  activePromotions: PromotionWithRules[],
): CalculationResult {
  const basePoints = Math.floor(orderAmount / POINTS_PER_CURRENCY_UNIT);
  const currentDay = DAYS_OF_WEEK[new Date().getDay()];

  let bestPoints = basePoints;
  let bestPromotionId: string | null = null;
  let bestPromotionName: string | null = null;

  for (const promotion of activePromotions) {
    for (const rule of promotion.rules) {
      const minSpend =
        typeof rule.minSpend === 'number'
          ? rule.minSpend
          : rule.minSpend.toNumber();

      if (orderAmount < minSpend) continue;
      if (rule.dayOfWeek && rule.dayOfWeek !== currentDay) continue;

      let points: number;
      switch (promotion.type) {
        case 'standard':
          points = rule.pointsAwarded;
          break;
        case 'multiplier':
          points = Math.floor(basePoints * rule.multiplier);
          break;
        case 'bonus':
          points = basePoints + rule.pointsAwarded;
          break;
        default:
          continue;
      }

      if (points > bestPoints) {
        bestPoints = points;
        bestPromotionId = promotion.id;
        bestPromotionName = promotion.name;
      }
    }
  }

  return {
    pointsEarned: bestPoints,
    promotionId: bestPromotionId,
    promotionName: bestPromotionName,
  };
}
