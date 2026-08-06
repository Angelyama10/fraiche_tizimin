export enum PriceAdjustmentDirection {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export enum PriceAdjustmentScope {
  ALL = 'ALL',
  LINE = 'LINE',
  BRAND = 'BRAND',
  CATEGORY = 'CATEGORY',
}

export enum PriceRoundingMode {
  CENT = 'CENT',
  PESO = 'PESO',
  FIVE_PESOS = 'FIVE_PESOS',
  TEN_PESOS = 'TEN_PESOS',
}

const ROUNDING_INCREMENT_CENTS: Record<PriceRoundingMode, number> = {
  [PriceRoundingMode.CENT]: 1,
  [PriceRoundingMode.PESO]: 100,
  [PriceRoundingMode.FIVE_PESOS]: 500,
  [PriceRoundingMode.TEN_PESOS]: 1000,
};

export function calculateAdjustedPriceCents(input: {
  currentPriceCents: number;
  direction: PriceAdjustmentDirection;
  percentage: number;
  rounding: PriceRoundingMode;
}) {
  const multiplier =
    input.direction === PriceAdjustmentDirection.INCREASE
      ? 1 + input.percentage / 100
      : 1 - input.percentage / 100;
  const increment = ROUNDING_INCREMENT_CENTS[input.rounding];
  const adjusted = Math.round((input.currentPriceCents * multiplier) / increment) * increment;

  return Math.max(1, adjusted);
}
