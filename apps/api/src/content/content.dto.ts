import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSiteContentDto {
  @IsObject()
  content!: Record<string, unknown>;
}

export class PresignMediaAssetDto {
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @IsString()
  @Matches(/^image\/(jpeg|png|webp|avif)$/)
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  altText?: string;
}

export class CompleteMediaAssetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12000)
  height?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  altText?: string;
}
