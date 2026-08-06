import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAdjustedPriceCents,
  PriceAdjustmentDirection,
  PriceRoundingMode,
} from './price-adjustment';

test('aumenta un precio por porcentaje conservando centavos', () => {
  assert.equal(
    calculateAdjustedPriceCents({
      currentPriceCents: 10_000,
      direction: PriceAdjustmentDirection.INCREASE,
      percentage: 16,
      rounding: PriceRoundingMode.CENT,
    }),
    11_600,
  );
});

test('redondea un aumento al multiplo de diez pesos mas cercano', () => {
  assert.equal(
    calculateAdjustedPriceCents({
      currentPriceCents: 35_000,
      direction: PriceAdjustmentDirection.INCREASE,
      percentage: 5,
      rounding: PriceRoundingMode.TEN_PESOS,
    }),
    37_000,
  );
});

test('permite reducciones con redondeo comercial a cinco pesos', () => {
  assert.equal(
    calculateAdjustedPriceCents({
      currentPriceCents: 38_000,
      direction: PriceAdjustmentDirection.DECREASE,
      percentage: 10,
      rounding: PriceRoundingMode.FIVE_PESOS,
    }),
    34_000,
  );
});

test('nunca genera un precio menor a un centavo', () => {
  assert.equal(
    calculateAdjustedPriceCents({
      currentPriceCents: 1,
      direction: PriceAdjustmentDirection.DECREASE,
      percentage: 99.99,
      rounding: PriceRoundingMode.CENT,
    }),
    1,
  );
});
