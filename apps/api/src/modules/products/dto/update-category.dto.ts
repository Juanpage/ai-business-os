import { CategoryStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { IsLocalizedText } from '../../../common/validators/is-localized-text.validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  name?: Record<string, string>;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;
}
