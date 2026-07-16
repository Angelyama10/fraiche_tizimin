import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ProductLine,
  ProductStatus,
  SpecialRequestStatus,
  TransferProofStatus,
} from '@prisma/client';

export class CreateProductImageDto {
  @IsUrl({ require_protocol: true })
  url!: string;

  @IsString()
  @IsNotEmpty()
  altText!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  concentrationLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  concentrationPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  volumeMl?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  catalogPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtPriceCents?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  initialStock!: number;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ProductLine)
  line!: ProductLine;

  @IsOptional()
  @IsString()
  brandSlug?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categorySlugs!: string[];

  @IsArray()
  @IsString({ each: true })
  scentSlugs!: string[];

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images: CreateProductImageDto[] = [];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;
}

export class UpdateVariantDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  catalogPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtPriceCents?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateInventoryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  onHand!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ReviewTransferProofDto {
  @IsEnum(TransferProofStatus)
  status!: TransferProofStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateSpecialRequestDto {
  @IsEnum(SpecialRequestStatus)
  status!: SpecialRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quotedCents?: number;
}
