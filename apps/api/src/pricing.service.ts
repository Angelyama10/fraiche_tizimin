import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PricingMode } from '@prisma/client';

type PriceSource = {
  catalogPriceCents: number | null;
  currency: string;
  product: {
    linePricingPolicy: {
      pricingMode: PricingMode;
      fixedPriceCents: number | null;
      currency: string;
      isActive: boolean;
    };
  };
};

@Injectable()
export class PricingService {
  resolveVariantPrice(variant: PriceSource) {
    const policy = variant.product.linePricingPolicy;

    if (!policy.isActive) {
      throw new InternalServerErrorException('La politica de precios no esta activa.');
    }

    const amountCents =
      policy.pricingMode === PricingMode.FIXED_BY_LINE
        ? policy.fixedPriceCents
        : variant.catalogPriceCents;

    if (amountCents === null || amountCents < 0) {
      throw new InternalServerErrorException('El producto no tiene un precio valido.');
    }

    return {
      amountCents,
      currency:
        policy.pricingMode === PricingMode.FIXED_BY_LINE
          ? policy.currency
          : variant.currency,
    };
  }
}
