import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class MercadoPagoIdentificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  number!: string;
}

class MercadoPagoPayerDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MercadoPagoIdentificationDto)
  identification?: MercadoPagoIdentificationDto;
}

export class ProcessMercadoPagoCardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  issuer_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  payment_method_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  transaction_amount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  installments!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => MercadoPagoPayerDto)
  payer!: MercadoPagoPayerDto;
}

export class PresignTransferProofDto {
  @IsString()
  orderToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;
}

export class ConfirmTransferProofDto {
  @IsString()
  @IsNotEmpty()
  objectKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;
}
