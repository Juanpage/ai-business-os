import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/identity/guards/jwt-auth.guard';
import { TenantGuard } from '../guards/tenant.guard';

/**
 * Protege una ruta con autenticacion + aislamiento de tenant en una sola
 * anotacion. El orden importa: JwtAuthGuard puebla `req.user` y TenantGuard
 * lo consume para resolver e inyectar el TenantContext.
 *
 * Uso: `@Auth()` sobre el controlador o el handler, junto con `@CurrentTenant()`.
 */
export function Auth() {
  return applyDecorators(UseGuards(JwtAuthGuard, TenantGuard));
}
