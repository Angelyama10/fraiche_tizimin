import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WhatsAppLinkQueryDto {
  @IsOptional()
  @IsString()
  cartToken?: string;

  @IsOptional()
  @IsString()
  orderToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
