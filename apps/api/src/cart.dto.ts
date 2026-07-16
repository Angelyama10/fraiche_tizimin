import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}
