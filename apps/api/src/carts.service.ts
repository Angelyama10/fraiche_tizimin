import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartStatus, Prisma, ProductStatus } from '@prisma/client';
import { AddCartItemDto, UpdateCartItemDto } from './cart.dto';
import { PricingService } from './pricing.service';
import { PrismaService } from './prisma.service';

const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          product: {
            include: {
              linePricingPolicy: true,
              images: {
                where: { isPrimary: true },
                orderBy: { sortOrder: 'asc' as const },
                take: 1,
              },
            },
          },
          inventoryLevels: { where: { location: { isActive: true } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async create() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const cart = await this.prisma.cart.create({
      data: { expiresAt },
      include: cartInclude,
    });
    return this.serializeCart(cart);
  }

  async get(publicToken: string) {
    const cart = await this.getCart(publicToken);
    return this.serializeCart(cart);
  }

  async addItem(publicToken: string, input: AddCartItemDto) {
    const cart = await this.getActiveCart(publicToken);
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: input.variantId,
        isActive: true,
        product: { status: ProductStatus.ACTIVE },
      },
      include: { inventoryLevels: { where: { location: { isActive: true } } } },
    });

    if (!variant) throw new NotFoundException('Variante no encontrada.');

    const available = variant.inventoryLevels.reduce(
      (total, inventory) => total + inventory.available,
      0,
    );
    const current = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    });
    const requestedQuantity = (current?.quantity ?? 0) + input.quantity;

    if (requestedQuantity > available) {
      throw new ConflictException(`Solo hay ${available} unidades disponibles.`);
    }

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
      update: { quantity: requestedQuantity },
      create: { cartId: cart.id, variantId: variant.id, quantity: input.quantity },
    });

    return this.get(publicToken);
  }

  async updateItem(
    publicToken: string,
    itemId: string,
    input: UpdateCartItemDto,
  ) {
    const cart = await this.getActiveCart(publicToken);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { variant: { include: { inventoryLevels: true } } },
    });
    if (!item) throw new NotFoundException('Partida del carrito no encontrada.');

    const available = item.variant.inventoryLevels.reduce(
      (total, inventory) => total + inventory.available,
      0,
    );
    if (input.quantity > available) {
      throw new ConflictException(`Solo hay ${available} unidades disponibles.`);
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: input.quantity },
    });
    return this.get(publicToken);
  }

  async removeItem(publicToken: string, itemId: string) {
    const cart = await this.getActiveCart(publicToken);
    const deleted = await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
    if (!deleted.count) throw new NotFoundException('Partida del carrito no encontrada.');
    return this.get(publicToken);
  }

  private async getCart(publicToken: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { publicToken },
      include: cartInclude,
    });
    if (!cart) throw new NotFoundException('Carrito no encontrado.');
    return cart;
  }

  private async getActiveCart(publicToken: string) {
    const cart = await this.getCart(publicToken);
    if (cart.status !== CartStatus.ACTIVE) {
      throw new BadRequestException('El carrito ya no esta activo.');
    }
    if (cart.expiresAt <= new Date()) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { status: CartStatus.EXPIRED },
      });
      throw new BadRequestException('El carrito ha expirado.');
    }
    return cart;
  }

  private serializeCart(cart: CartWithItems) {
    const items = cart.items.map((item) => {
      const product = item.variant.product;
      const price = this.pricing.resolveVariantPrice({
        ...item.variant,
        product,
      });
      const available = item.variant.inventoryLevels.reduce(
        (total, inventory) => total + inventory.available,
        0,
      );

      return {
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        product: {
          slug: product.slug,
          name: product.name,
          line: product.line,
          image: product.images[0] ?? null,
        },
        variant: {
          sku: item.variant.sku,
          name: item.variant.name,
          concentrationLabel: item.variant.concentrationLabel,
          volumeMl: item.variant.volumeMl,
        },
        unitPriceCents: price.amountCents,
        lineTotalCents: price.amountCents * item.quantity,
        currency: price.currency,
        available,
      };
    });

    return {
      publicToken: cart.publicToken,
      status: cart.status,
      currency: cart.currency,
      expiresAt: cart.expiresAt,
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotalCents: items.reduce((total, item) => total + item.lineTotalCents, 0),
    };
  }
}
