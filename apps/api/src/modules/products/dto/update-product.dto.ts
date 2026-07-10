import { ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsObject, IsOptional, IsUUID, Min } from 'class-validator';
import { IsLocalizedText } from '../../../common/validators/is-localized-text.validator';

export class UpdateProductDto {
  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  name?: Record<string, string>;

  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
