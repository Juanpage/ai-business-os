import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, VenueRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateMemberDto } from './dto/create-member.dto';
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

  async createMember(ctx: TenantContext, dto: CreateMemberDto) {
    if (dto.venueId) {
      await this.assertVenueInTenant(ctx.tenantId, dto.venueId);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { tenantId: ctx.tenantId, email: dto.email, passwordHash },
        });

        await tx.userVenueRole.create({
          data: {
            tenantId: ctx.tenantId,
            userId: created.id,
            role: dto.role,
            venueId: dto.venueId ?? null,
          },
        });

        return created;
      });

      return {
        id: user.id,
        email: user.email,
        status: user.status,
        roles: [{ role: dto.role, venueId: dto.venueId ?? null }],
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un usuario con ese email en el tenant.');
      }
      throw error;
    }
  }

  async listMembers(ctx: TenantContext) {
    return this.prisma.user.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        status: true,
        venueRoles: {
          where: { deletedAt: null },
          select: { role: true, venueId: true },
        },
      },
    });
  }

  async assignRole(ctx: TenantContext, userId: string, dto: AssignRoleDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado en el tenant.');
    }

    if (dto.venueId) {
      await this.assertVenueInTenant(ctx.tenantId, dto.venueId);
    }

    const venueId = dto.venueId ?? null;
    const existing = await this.prisma.userVenueRole.findFirst({
      where: { userId, tenantId: ctx.tenantId, role: dto.role, venueId },
    });

    if (existing) {
      // Reactiva si estaba soft-deleted; si ya esta activo, es idempotente.
      if (existing.deletedAt) {
        return this.prisma.userVenueRole.update({
          where: { id: existing.id },
          data: { deletedAt: null, status: 'active' },
        });
      }
      return existing;
    }

    return this.prisma.userVenueRole.create({
      data: { tenantId: ctx.tenantId, userId, role: dto.role, venueId },
    });
  }

  private async assertVenueInTenant(tenantId: string, venueId: string): Promise<void> {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundException('El venue indicado no pertenece al tenant.');
    }
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
