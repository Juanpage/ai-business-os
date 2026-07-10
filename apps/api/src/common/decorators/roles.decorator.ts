import { SetMetadata } from '@nestjs/common';
import { VenueRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Declara los roles que pueden ejecutar una ruta. Lo evalua RolesGuard.
 * Sin este decorador, la ruta no exige rol (solo autenticacion + tenant).
 * Uso: `@Roles(VenueRole.owner, VenueRole.admin)`.
 */
export const Roles = (...roles: VenueRole[]) => SetMetadata(ROLES_KEY, roles);
