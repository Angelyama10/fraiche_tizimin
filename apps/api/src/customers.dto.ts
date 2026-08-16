import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ADDRESS_NUMBER_PATTERN,
  ADDRESS_TEXT_PATTERN,
  COUNTRY_PATTERN,
  PERSON_NAME_PATTERN,
  PHONE_PATTERN,
  PLACE_PATTERN,
  POSTAL_CODE_PATTERN,
} from './shipping-address.validation';

export class UpdateCustomerProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'El telefono debe contener exactamente 10 digitos.' })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

export class CustomerAddressDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(120)
  @Matches(PERSON_NAME_PATTERN, { message: 'El nombre del destinatario no es valido.' })
  recipientName!: string;

  @IsString()
  @Matches(PHONE_PATTERN, { message: 'El telefono debe contener exactamente 10 digitos.' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(160)
  @Matches(ADDRESS_TEXT_PATTERN, { message: 'La calle contiene caracteres no validos.' })
  street!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(ADDRESS_NUMBER_PATTERN, { message: 'El numero exterior no es valido.' })
  exteriorNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(ADDRESS_NUMBER_PATTERN, { message: 'El numero interior no es valido.' })
  interiorNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'La colonia no es valida.' })
  neighborhood!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'La ciudad no es valida.' })
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'El municipio no es valido.' })
  municipality!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
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
  @MinLength(5)
  @MaxLength(300)
  @Matches(ADDRESS_TEXT_PATTERN, { message: 'La referencia contiene caracteres no validos.' })
  reference?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCustomerAddressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(120)
  @Matches(PERSON_NAME_PATTERN, { message: 'El nombre del destinatario no es valido.' })
  recipientName?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'El telefono debe contener exactamente 10 digitos.' })
  phone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(160)
  @Matches(ADDRESS_TEXT_PATTERN, { message: 'La calle contiene caracteres no validos.' })
  street?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(ADDRESS_NUMBER_PATTERN, { message: 'El numero exterior no es valido.' })
  exteriorNumber?: string;

  @ValidateIf((_input, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @MaxLength(20)
  @Matches(ADDRESS_NUMBER_PATTERN, { message: 'El numero interior no es valido.' })
  interiorNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'La colonia no es valida.' })
  neighborhood?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'La ciudad no es valida.' })
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'El municipio no es valido.' })
  municipality?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PLACE_PATTERN, { message: 'El estado no es valido.' })
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(POSTAL_CODE_PATTERN, { message: 'El codigo postal debe contener 5 digitos.' })
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Matches(COUNTRY_PATTERN, { message: 'El pais debe ser MX.' })
  country?: string;

  @ValidateIf((_input, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  @Matches(ADDRESS_TEXT_PATTERN, { message: 'La referencia contiene caracteres no validos.' })
  reference?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
