import { ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsObject, IsOptional, IsUUID, Min } from 'class-validator';
import { IsLocalizedText } from '../../../common/validators/is-localized-text.validator';

export class CreateProductDto {
  @IsObject()
  @IsLocalizedText()
  name!: Record<string, string>;

  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  description?: Record<string, string>;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Si se omite, el producto es a nivel tenant (aplica a todos los venues). */
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
