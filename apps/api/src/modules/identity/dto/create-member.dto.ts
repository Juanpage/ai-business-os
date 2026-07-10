import { VenueRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(VenueRole)
  role!: VenueRole;

  /** Si se omite, el rol es a nivel tenant (aplica a todos los venues). */
  @IsOptional()
  @IsUUID()
  venueId?: string;
}
