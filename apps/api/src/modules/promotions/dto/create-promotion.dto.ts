import { PromotionDiscountType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsUUID, Min } from 'class-validator';
import { IsLocalizedText } from '../../../common/validators/is-localized-text.validator';

export class CreatePromotionDto {
  @IsObject()
  @IsLocalizedText()
  name!: Record<string, string>;

  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsEnum(PromotionDiscountType)
  discountType!: PromotionDiscountType;

  /** Si percentage: 0-100; si fixed: monto. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue!: number;

  /** Si se omite, la promocion es a nivel tenant (todos los venues). */
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
