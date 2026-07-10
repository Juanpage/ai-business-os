import { CategoryStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { IsLocalizedText } from '../../../common/validators/is-localized-text.validator';

export class CreateCategoryDto {
  @IsObject()
  @IsLocalizedText()
  name!: Record<string, string>;

  /** Si se omite, la categoria es a nivel tenant (aplica a todos los venues). */
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;
}
