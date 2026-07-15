import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { PLATFORM_SCOPE, PlatformJwtPayload } from './strategies/platform-jwt.strategy';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.platformAdmin.findFirst({
      where: { email: dto.email, status: 'active', deletedAt: null },
    });

    if (!admin || !(await bcrypt.compare(dto.password, admin.passwordHash))) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const payload: PlatformJwtPayload = {
      sub: admin.id,
      email: admin.email,
      scope: PLATFORM_SCOPE,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      admin: { id: admin.id, email: admin.email },
    };
  }
}
