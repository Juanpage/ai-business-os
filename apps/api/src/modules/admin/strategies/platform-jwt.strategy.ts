import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** Nombre de la estrategia (separado del 'jwt' de tenants). */
export const PLATFORM_STRATEGY = 'platform-jwt';

/** Marca que distingue un token de plataforma de uno de tenant. */
export const PLATFORM_SCOPE = 'platform';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  scope: typeof PLATFORM_SCOPE;
}

export interface PlatformAdminContext {
  adminId: string;
  email: string;
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, PLATFORM_STRATEGY) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET no configurado');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: PlatformJwtPayload): PlatformAdminContext {
    // Un token de tenant (sin scope de plataforma) no sirve aqui.
    if (payload.scope !== PLATFORM_SCOPE) {
      throw new UnauthorizedException('Token no valido para la plataforma.');
    }
    return { adminId: payload.sub, email: payload.email };
  }
}
