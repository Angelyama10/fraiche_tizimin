import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DeliveryMethod, PaymentMethod } from '@prisma/client';

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  street!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  country = 'MX';

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateOrderDto {
  @IsString()
  cartToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  customerName!: string;

  @IsEmail()
  customerEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  customerPhone!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @ValidateIf((input: CreateOrderDto) => input.deliveryMethod !== DeliveryMethod.STORE_PICKUP)
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
