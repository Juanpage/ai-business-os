import { applyDecorators, createParamDecorator, ExecutionContext, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../guards/platform-auth.guard';
import { PlatformAdminContext } from '../strategies/platform-jwt.strategy';

/** Protege una ruta como back-office de plataforma (super-admin). */
export function PlatformAuth() {
  return applyDecorators(UseGuards(PlatformAuthGuard));
}

/** Inyecta el admin de plataforma autenticado en el handler. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAdminContext => {
    return ctx.switchToHttp().getRequest().user as PlatformAdminContext;
  },
);
