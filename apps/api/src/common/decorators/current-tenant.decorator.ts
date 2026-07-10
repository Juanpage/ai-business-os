import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { TenantAwareRequest, TenantContext } from '../tenant/tenant-context';

/**
 * Inyecta el TenantContext resuelto por TenantGuard en el handler.
 * Uso: `metodo(@CurrentTenant() ctx: TenantContext)`.
 *
 * Si el contexto no existe es un error de programacion (falta @Auth()/TenantGuard
 * en la ruta), no un fallo del cliente: se responde 500, no 401.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<TenantAwareRequest>();
    if (!request.tenantContext) {
      throw new InternalServerErrorException(
        'TenantContext ausente: la ruta debe usar @Auth() (JwtAuthGuard + TenantGuard).',
      );
    }
    return request.tenantContext;
  },
);
