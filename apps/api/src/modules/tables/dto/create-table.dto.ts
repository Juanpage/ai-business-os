import { TableStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTableDto {
  /** El local al que pertenece la mesa (obligatorio; validado contra el tenant). */
  @IsUUID()
  venueId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;
}
