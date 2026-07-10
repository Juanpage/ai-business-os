import { AuthenticatedUser } from '../../modules/identity/strategies/jwt.strategy';

/**
 * Contexto de aislamiento resuelto por TenantGuard y adjuntado a la request.
 * - tenantId: siempre presente en rutas autenticadas (proviene del JWT).
 * - venueId: null salvo que la request declare un local via header `x-venue-id`
 *   y este pertenezca al tenant.
 */
export interface TenantContext {
  tenantId: string;
  venueId: string | null;
}

/**
 * Forma de la request de Express una vez pasada la cadena de auth:
 * `user` lo inyecta Passport (JwtStrategy) y `tenantContext` el TenantGuard.
 */
export interface TenantAwareRequest {
  user?: AuthenticatedUser;
  tenantContext?: TenantContext;
  headers: Record<string, string | string[] | undefined>;
}

/** Nombre del header por el que la request declara el local activo. */
export const VENUE_HEADER = 'x-venue-id';
