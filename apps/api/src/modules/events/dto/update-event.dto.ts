import { EventStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsObject, IsOptional, Min } from 'class-validator';
import { IsLocalizedText } from '../../../common/validators/is-localized-text.validator';

export class UpdateEventDto {
  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  name?: Record<string, string>;

  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  coverPrice?: number;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
