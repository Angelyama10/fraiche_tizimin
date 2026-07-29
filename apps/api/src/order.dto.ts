import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DeliveryMethod, PaymentMethod, PaymentProvider } from '@prisma/client';

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  recipientName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  street!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  exteriorNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  interiorNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  neighborhood!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  municipality?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  country = 'MX';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reference?: string;
}

export class CreateOrderDto {
  @IsString()
  cartToken!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;

  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @IsOptional()
  @IsString()
  shippingAddressId?: string;

  @ValidateIf(
    (input: CreateOrderDto) =>
      input.deliveryMethod !== DeliveryMethod.STORE_PICKUP && !input.shippingAddressId,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @IsOptional()
  @IsString()
  promotionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNotes?: string;
}

export class UpdatePendingOrderDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;

  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @IsOptional()
  @IsString()
  shippingAddressId?: string;

  @ValidateIf(
    (input: UpdatePendingOrderDto) =>
      input.deliveryMethod !== DeliveryMethod.STORE_PICKUP && !input.shippingAddressId,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNotes?: string;
}

export class ListCustomerOrdersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}
