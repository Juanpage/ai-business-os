import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Venue } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { buildSlug, normalizeSlug } from '../../common/utils/slug';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, dto: CreateVenueDto): Promise<Venue> {
    await this.assertVenueQuota(ctx.tenantId);

    const slug = dto.slug ? normalizeSlug(dto.slug) : buildSlug(dto.name);

    try {
      return await this.prisma.venue.create({
        data: {
          tenantId: ctx.tenantId,
          name: dto.name,
          slug,
          ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`Ya existe un venue con el slug "${slug}" en este tenant.`);
      }
      throw error;
    }
  }

  async findAll(ctx: TenantContext): Promise<Venue[]> {
    return this.prisma.venue.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ctx: TenantContext, id: string): Promise<Venue> {
    const venue = await this.prisma.venue.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!venue) {
      throw new NotFoundException('Venue no encontrado.');
    }

    return venue;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateVenueDto): Promise<Venue> {
    // Garantiza pertenencia al tenant antes de actualizar.
    await this.findOne(ctx, id);

    return this.prisma.venue.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<Venue> {
    await this.findOne(ctx, id);

    // Soft delete.
    return this.prisma.venue.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hace cumplir el limite de locales del plan contratado (facturacion SaaS).
   * Sin suscripcion vigente no se aplica limite; `maxVenues` null = ilimitado.
   */
  private async assertVenueQuota(tenantId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['trialing', 'active', 'past_due'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true, maxVenues: true } } },
    });

    const maxVenues = subscription?.plan.maxVenues;
    if (maxVenues == null) {
      return;
    }

    const current = await this.prisma.venue.count({
      where: { tenantId, deletedAt: null },
    });

    if (current >= maxVenues) {
      throw new ConflictException(
        `El plan "${subscription!.plan.name}" permite ${maxVenues} local(es) y ya tienes ${current}. Actualiza tu plan para agregar mas.`,
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
