import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { VenueRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const slug = this.buildSlug(dto.tenantName);

    // Onboarding: crea el Tenant y su usuario propietario (owner) de forma atomica.
    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug },
      });

      const createdUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
        },
      });

      await tx.userVenueRole.create({
        data: {
          tenantId: tenant.id,
          userId: createdUser.id,
          role: VenueRole.owner,
        },
      });

      return createdUser;
    });

    return this.buildAuthResult(user.id, user.tenantId, user.email);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    return this.buildAuthResult(user.id, user.tenantId, user.email);
  }

  private async buildAuthResult(
    userId: string,
    tenantId: string,
    email: string,
  ): Promise<AuthResult> {
    const payload: JwtPayload = { sub: userId, tenantId, email };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: { id: userId, tenantId, email },
    };
  }

  private buildSlug(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

    const suffix = randomBytes(3).toString('hex');
    return `${base || 'tenant'}-${suffix}`;
  }
}

export interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    tenantId: string;
    email: string;
  };
}
