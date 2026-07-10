import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma, VenueRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { TenantAwareRequest } from '../tenant/tenant-context';

/**
 * Autorizacion por rol. Debe correr DESPUES de JwtAuthGuard y TenantGuard
 * (necesita `req.user` y `req.tenantContext`). Los roles se leen de la DB en
 * cada request (no del JWT), asi reflejan siempre el estado real.
 *
 * Un rol a nivel tenant (venueId = null) aplica en todo el tenant; un rol de
 * venue solo cuenta para el venue activo declarado en `x-venue-id`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<VenueRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sin @Roles en la ruta: no se exige rol.
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantAwareRequest>();
    const user = request.user;
    const ctx = request.tenantContext;

    if (!user || !ctx) {
      throw new ForbiddenException('Contexto de autenticacion o tenant ausente.');
    }

    const venueScopes: Prisma.UserVenueRoleWhereInput[] = [{ venueId: null }];
    if (ctx.venueId) {
      venueScopes.push({ venueId: ctx.venueId });
    }

    const match = await this.prisma.userVenueRole.findFirst({
      where: {
        userId: user.userId,
        tenantId: ctx.tenantId,
        deletedAt: null,
        role: { in: required },
        OR: venueScopes,
      },
      select: { id: true },
    });

    if (!match) {
      throw new ForbiddenException('Rol insuficiente para esta operacion.');
    }

    return true;
  }
}
