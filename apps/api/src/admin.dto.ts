import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  Matches,
  Max,
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
  @IsUrl({ require_protocol: true, require_tld: false })
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
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, {
    message: 'El SKU solo permite letras, numeros, punto, guion y guion bajo.',
  })
  sku!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  concentrationLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo permite minusculas, numeros y guiones.',
  })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  shortDescription!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  seoDescription?: string;

  @IsEnum(ProductLine)
  line!: ProductLine;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsString()
  @IsNotEmpty()
  brandSlug!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categorySlugs!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  catalogLineSlugs!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  inspirationHouseSlug?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsArray()
  @ArrayMaxSize(8)
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
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  brandSlug?: string;

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
  @MaxLength(70)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  seoDescription?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categorySlugs?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  catalogLineSlugs?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  inspirationHouseSlug?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images?: CreateProductImageDto[];
}

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo permite minusculas, numeros y guiones.',
  })
  slug?: string;
}

export class CreatePerfumeHouseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo permite minusculas, numeros y guiones.',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo permite minusculas, numeros y guiones.',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  parentSlug?: string;
}

export class SkuAvailabilityQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;
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
