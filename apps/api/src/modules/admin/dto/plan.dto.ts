import { BillingInterval, PlanStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name!: string;

  /** Codigo unico e inmutable del plan (ej. "pro"). */
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'code solo admite minusculas, numeros y guiones' })
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  /** null = ilimitado. */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxVenues?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number | null;

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxVenues?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number | null;

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;
}
