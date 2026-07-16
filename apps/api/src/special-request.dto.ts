import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProductLine } from '@prisma/client';

export class CreateSpecialRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  customerName!: string;

  @IsEmail()
  customerEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  requestedAroma!: string;

  @IsOptional()
  @IsEnum(ProductLine)
  preferredLine?: ProductLine;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
