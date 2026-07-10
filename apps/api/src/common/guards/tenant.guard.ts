import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantAwareRequest, TenantContext, VENUE_HEADER } from '../tenant/tenant-context';

/**
 * Guard de aislamiento multi-tenant. Debe correr DESPUES de JwtAuthGuard
 * (el JWT ya poblo `req.user` con el tenantId). Responsabilidades:
 *  1. Exigir un usuario autenticado con tenantId.
 *  2. Resolver el venue activo desde el header `x-venue-id` (opcional).
 *  3. Validar que ese venue pertenece al tenant y no esta soft-deleted.
 *  4. Inyectar `req.tenantContext` para @CurrentTenant().
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantAwareRequest>();
    const user = request.user;

    if (!user?.tenantId) {
      throw new ForbiddenException('Request sin tenant autenticado.');
    }

    const venueId = this.extractVenueId(request);

    if (venueId) {
      const venue = await this.prisma.venue.findFirst({
        where: { id: venueId, tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });

      if (!venue) {
        throw new ForbiddenException('El venue indicado no pertenece al tenant o no existe.');
      }
    }

    const tenantContext: TenantContext = {
      tenantId: user.tenantId,
      venueId: venueId ?? null,
    };
    request.tenantContext = tenantContext;

    return true;
  }

  private extractVenueId(request: TenantAwareRequest): string | null {
    const raw = request.headers[VENUE_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
