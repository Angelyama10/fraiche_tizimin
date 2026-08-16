import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DeliveryMethod, PaymentMethod, PaymentProvider } from '@prisma/client';
import {
  ADDRESS_NUMBER_PATTERN,
  ADDRESS_TEXT_PATTERN,
  COUNTRY_PATTERN,
  PERSON_NAME_PATTERN,
  PHONE_PATTERN,
  PLACE_PATTERN,
  POSTAL_CODE_PATTERN,
} from './shipping-address.validation';

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre de quien recibe.' })
  @MinLength(3, { message: 'El nombre de quien recibe debe tener al menos 3 caracteres.' })
  @MaxLength(120)
  @Matches(PERSON_NAME_PATTERN, { message: 'El nombre del destinatario no es valido.' })
  recipientName!: string;

  @IsString()
  @Matches(PHONE_PATTERN, { message: 'El telefono debe contener exactamente 10 digitos.' })
  phone!: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe la calle de entrega.' })
  @MinLength(3, { message: 'La calle debe tener al menos 3 caracteres.' })
  @MaxLength(160)
  @Matches(ADDRESS_TEXT_PATTERN, { message: 'La calle contiene caracteres no validos.' })
  street!: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe el numero exterior.' })
  @MaxLength(20)
  @Matches(ADDRESS_NUMBER_PATTERN, { message: 'El numero exterior no es valido.' })
  exteriorNumber!: string;

  @ValidateIf((_input, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @MaxLength(20)
  @Matches(ADDRESS_NUMBER_PATTERN, { message: 'El numero interior no es valido.' })
  interiorNumber?: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe la colonia.' })
  @MinLength(2, { message: 'La colonia debe tener al menos 2 caracteres.' })
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'La colonia no es valida.' })
  neighborhood!: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe la ciudad.' })
  @MinLength(2, { message: 'La ciudad debe tener al menos 2 caracteres.' })
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'La ciudad no es valida.' })
  city!: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe el municipio.' })
  @MinLength(2, { message: 'El municipio debe tener al menos 2 caracteres.' })
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'El municipio no es valido.' })
  municipality!: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe el estado.' })
  @MinLength(2, { message: 'El estado debe tener al menos 2 caracteres.' })
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'El estado no es valido.' })
  state!: string;

  @IsString()
  @Matches(POSTAL_CODE_PATTERN, { message: 'El codigo postal debe contener 5 digitos.' })
  postalCode!: string;

  @IsString()
  @MaxLength(2)
  @Matches(COUNTRY_PATTERN, { message: 'El pais debe ser MX.' })
  country = 'MX';

  @ValidateIf((_input, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @MinLength(5, { message: 'La referencia debe tener al menos 5 caracteres.' })
  @MaxLength(300)
  @Matches(ADDRESS_TEXT_PATTERN, { message: 'La referencia contiene caracteres no validos.' })
  reference?: string;
}

export class CreateOrderDto {
  @IsString()
  cartToken!: string;

  @ValidateIf(
    (input: CreateOrderDto) =>
      input.deliveryMethod === DeliveryMethod.STORE_PICKUP ||
      input.paymentMethod !== undefined,
  )
  @IsEnum(PaymentMethod, {
    message: 'Selecciona una forma de pago para recoger en tienda.',
  })
  paymentMethod?: PaymentMethod;

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

export class SelectOrderPaymentDto {
  @IsEnum(PaymentMethod, { message: 'Selecciona una forma de pago valida.' })
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentProvider, { message: 'Selecciona una pasarela valida.' })
  paymentProvider?: PaymentProvider;
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
