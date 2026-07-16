import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  @IsUrl({ require_protocol: true })
  fileUrl!: string;

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
