import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  PricingMode,
  ProductLine,
  ProductStatus,
  PromotionPlacement,
  PromotionType,
  ShipmentStatus,
} from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

export class ListAdminNotificationsDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  unreadOnly?: boolean;
}

export class ListAdminOrdersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(FulfillmentStatus)
  fulfillmentStatus?: FulfillmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class ListAdminProductsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsEnum(ProductLine)
  line?: ProductLine;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class ListAdminInventoryDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  outOfStock?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;
}

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  carrier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  service?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  trackingNumber!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(500)
  trackingUrl?: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsDateString()
  estimatedDeliveryAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateShipmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  service?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  trackingNumber?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(500)
  trackingUrl?: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsDateString()
  estimatedDeliveryAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  eventDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  eventLocation?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug debe usar solo letras minusculas, numeros y guiones.',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(500)
  imageUrl?: string;

  @IsEnum(PromotionType)
  type!: PromotionType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  value!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximumDiscountCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximumUses?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perCustomerLimit?: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsEnum(PromotionPlacement)
  placement?: PromotionPlacement;

  @IsOptional()
  @IsBoolean()
  requiresCode?: boolean;

  @IsOptional()
  @IsBoolean()
  isStackable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  categoryIds?: string[];
}

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}

export class ListPromotionsDto extends PaginationDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  active?: boolean;

  @IsOptional()
  @IsEnum(PromotionPlacement)
  placement?: PromotionPlacement;
}

export class UpdatePricingPolicyDto {
  @IsEnum(PricingMode)
  pricingMode!: PricingMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fixedPriceCents?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class VariantPriceUpdateDto {
  @IsString()
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  catalogPriceCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtPriceCents?: number;
}

export class BulkUpdatePricesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => VariantPriceUpdateDto)
  updates!: VariantPriceUpdateDto[];
}
