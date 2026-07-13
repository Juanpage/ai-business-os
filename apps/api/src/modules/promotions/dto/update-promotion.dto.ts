import { PromotionDiscountType, PromotionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsObject, IsOptional, Min } from 'class-validator';
import { IsLocalizedText } from '../../../common/validators/is-localized-text.validator';

export class UpdatePromotionDto {
  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  name?: Record<string, string>;

  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsOptional()
  @IsEnum(PromotionDiscountType)
  discountType?: PromotionDiscountType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;
}
