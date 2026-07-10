import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/identity/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../guards/tenant.guard';

/**
 * Protege una ruta con autenticacion + aislamiento de tenant + autorizacion
 * por rol en una sola anotacion. El orden importa:
 *   1. JwtAuthGuard  -> puebla req.user desde el JWT.
 *   2. TenantGuard   -> resuelve/valida tenant y venue, inyecta TenantContext.
 *   3. RolesGuard    -> exige @Roles(...) si la ruta lo declara (si no, no-op).
 *
 * Uso: `@Auth()` (+ opcional `@Roles(...)`) junto con `@CurrentTenant()`.
 */
export function Auth() {
  return applyDecorators(UseGuards(JwtAuthGuard, TenantGuard, RolesGuard));
}
