import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartStatus, Prisma, ProductStatus } from '@prisma/client';
import { CustomerAddressDto, UpdateCustomerAddressDto, UpdateCustomerProfileDto } from './customers.dto';
import { PricingService } from './pricing.service';
import { PrismaService } from './prisma.service';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async profile(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, isActive: true, passwordHash: { not: null } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        marketingOptIn: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { orders: true, addresses: true, wishlistItems: true } },
      },
    });
    if (!customer) throw new NotFoundException('Cuenta no encontrada.');
    return customer;
  }

  async updateProfile(customerId: string, input: UpdateCustomerProfileDto) {
    await this.ensureActive(customerId);
    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: input.firstName?.trim(),
        lastName: input.lastName?.trim(),
        phone: input.phone?.trim(),
        marketingOptIn: input.marketingOptIn,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        marketingOptIn: true,
        emailVerifiedAt: true,
        updatedAt: true,
      },
    });
  }

  async addresses(customerId: string) {
    await this.ensureActive(customerId);
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(customerId: string, input: CustomerAddressDto) {
    await this.ensureActive(customerId);
    return this.prisma.$transaction(async (transaction) => {
      const count = await transaction.customerAddress.count({ where: { customerId } });
      const isDefault = input.isDefault ?? count === 0;
      if (isDefault) {
        await transaction.customerAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return transaction.customerAddress.create({
        data: {
          ...this.addressData(input),
          customerId,
          isDefault,
        },
      });
    });
  }

  async updateAddress(customerId: string, addressId: string, input: UpdateCustomerAddressDto) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address) throw new NotFoundException('Direccion no encontrada.');
    if (address.isDefault && input.isDefault === false) {
      throw new BadRequestException('Selecciona otra direccion como predeterminada primero.');
    }

    return this.prisma.$transaction(async (transaction) => {
      if (input.isDefault) {
        await transaction.customerAddress.updateMany({
          where: { customerId, id: { not: addressId }, isDefault: true },
          data: { isDefault: false },
        });
      }
      return transaction.customerAddress.update({
        where: { id: addressId },
        data: {
          label: input.label?.trim(),
          recipientName: input.recipientName?.trim(),
          phone: input.phone?.trim(),
          street: input.street?.trim(),
          exteriorNumber: input.exteriorNumber?.trim(),
          interiorNumber: input.interiorNumber?.trim(),
          neighborhood: input.neighborhood?.trim(),
          city: input.city?.trim(),
          municipality: input.municipality?.trim(),
          state: input.state?.trim(),
          postalCode: input.postalCode?.trim(),
          country: input.country?.trim().toUpperCase(),
          reference: input.reference?.trim(),
          isDefault: input.isDefault,
        },
      });
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address) throw new NotFoundException('Direccion no encontrada.');

    await this.prisma.$transaction(async (transaction) => {
      await transaction.customerAddress.delete({ where: { id: addressId } });
      if (address.isDefault) {
        const next = await transaction.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
        });
        if (next) {
          await transaction.customerAddress.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });
    return { deleted: true };
  }

  async claimCart(customerId: string, publicToken: string) {
    await this.ensureActive(customerId);
    const claimed = await this.prisma.cart.updateMany({
      where: {
        publicToken,
        status: CartStatus.ACTIVE,
        expiresAt: { gt: new Date() },
        OR: [{ customerId: null }, { customerId }],
      },
      data: { customerId },
    });
    if (!claimed.count) {
      throw new ConflictException('El carrito no esta disponible para esta cuenta.');
    }
    return { claimed: true, cartToken: publicToken };
  }

  async wishlist(customerId: string) {
    await this.ensureActive(customerId);
    const items = await this.prisma.wishlistItem.findMany({
      where: { customerId, product: { status: ProductStatus.ACTIVE } },
      include: {
        product: {
          include: {
            linePricingPolicy: true,
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
            variants: {
              where: { isActive: true },
              include: { inventoryLevels: { where: { location: { isActive: true } } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => ({
      addedAt: item.createdAt,
      product: {
        id: item.product.id,
        slug: item.product.slug,
        name: item.product.name,
        line: item.product.line,
        shortDescription: item.product.shortDescription,
        image: item.product.images[0] ?? null,
        variants: item.product.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          price: this.pricing.resolveVariantPrice({ ...variant, product: item.product }),
          available: variant.inventoryLevels.reduce((sum, level) => sum + level.available, 0),
        })),
      },
    }));
  }

  async addWishlistItem(customerId: string, productId: string) {
    await this.ensureActive(customerId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado.');
    await this.prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId, productId } },
      update: {},
      create: { customerId, productId },
    });
    return { added: true, productId };
  }

  async removeWishlistItem(customerId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { customerId, productId } });
    return { removed: true, productId };
  }

  private async ensureActive(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, isActive: true, passwordHash: { not: null } },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Cuenta no encontrada.');
  }

  private addressData(input: CustomerAddressDto) {
    return {
      label: input.label.trim(),
      recipientName: input.recipientName.trim(),
      phone: input.phone.trim(),
      street: input.street.trim(),
      exteriorNumber: input.exteriorNumber.trim(),
      interiorNumber: input.interiorNumber?.trim(),
      neighborhood: input.neighborhood.trim(),
      city: input.city.trim(),
      municipality: input.municipality?.trim(),
      state: input.state.trim(),
      postalCode: input.postalCode.trim(),
      country: input.country?.trim().toUpperCase() ?? 'MX',
      reference: input.reference?.trim(),
    } satisfies Prisma.CustomerAddressCreateWithoutCustomerInput;
  }
}
