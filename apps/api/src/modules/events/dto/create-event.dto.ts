import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsObject, IsOptional, IsUUID, Min } from 'class-validator';
import { IsLocalizedText } from '../../../common/validators/is-localized-text.validator';

export class CreateEventDto {
  /** Local del evento (obligatorio; validado contra el tenant). */
  @IsUUID()
  venueId!: string;

  @IsObject()
  @IsLocalizedText()
  name!: Record<string, string>;

  @IsOptional()
  @IsObject()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsDateString()
  startsAt!: string;

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
}
