import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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

  validate(payload: JwtPayload): AuthenticatedUser {
    // Rechaza tokens que no sean de un usuario de tenant (p. ej. los de
    // plataforma, que no llevan tenantId). Aislamiento estricto tenant<->admin.
    if (!payload.tenantId) {
      throw new UnauthorizedException('Token no valido para este recurso.');
    }
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
    };
  }
}
