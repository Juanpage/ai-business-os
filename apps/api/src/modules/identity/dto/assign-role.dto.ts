import { VenueRole } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsEnum(VenueRole)
  role!: VenueRole;

  /** Si se omite, el rol es a nivel tenant (aplica a todos los venues). */
  @IsOptional()
  @IsUUID()
  venueId?: string;
}
