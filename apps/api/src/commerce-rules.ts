import { OrderStatus, PromotionType, ShipmentStatus } from '@prisma/client';

const shipmentTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: [ShipmentStatus.LABEL_CREATED, ShipmentStatus.CANCELLED],
  LABEL_CREATED: [
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.EXCEPTION,
    ShipmentStatus.CANCELLED,
  ],
  IN_TRANSIT: [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.EXCEPTION,
    ShipmentStatus.RETURNED,
  ],
  OUT_FOR_DELIVERY: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.EXCEPTION,
    ShipmentStatus.RETURNED,
  ],
  EXCEPTION: [
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.RETURNED,
    ShipmentStatus.CANCELLED,
  ],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

const orderTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING],
  [OrderStatus.PROCESSING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
};

export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus) {
  return from === to || shipmentTransitions[from].includes(to);
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return from === to || Boolean(orderTransitions[from]?.includes(to));
}

export function calculatePromotionDiscount(input: {
  type: PromotionType;
  value: number;
  eligibleSubtotalCents: number;
  maximumDiscountCents?: number | null;
}) {
  const rawDiscount =
    input.type === PromotionType.PERCENTAGE
      ? Math.floor((input.eligibleSubtotalCents * input.value) / 100)
      : Math.min(input.value, input.eligibleSubtotalCents);
  return input.maximumDiscountCents
    ? Math.min(rawDiscount, input.maximumDiscountCents)
    : rawDiscount;
}

export function selectAppliedPromotions<
  T extends { promotion: { isStackable: boolean }; discountCents: number },
>(evaluated: T[], explicitCode: boolean, subtotalCents: number) {
  const selected = explicitCode
    ? evaluated.slice(0, 1)
    : [
        ...evaluated.filter((entry) => !entry.promotion.isStackable).slice(0, 1),
        ...evaluated.filter((entry) => entry.promotion.isStackable),
      ];
  let remaining = subtotalCents;
  return selected.flatMap((entry) => {
    const discountCents = Math.min(entry.discountCents, remaining);
    remaining -= discountCents;
    return discountCents > 0 ? [{ ...entry, discountCents }] : [];
  });
}
