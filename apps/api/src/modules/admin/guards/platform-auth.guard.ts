import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PLATFORM_STRATEGY } from '../strategies/platform-jwt.strategy';

/** Autenticacion del admin de plataforma (no pasa por TenantGuard/RolesGuard). */
@Injectable()
export class PlatformAuthGuard extends AuthGuard(PLATFORM_STRATEGY) {}
